import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

// The repository as the gates read it: repository-relative POSIX paths in, text out.
//
// It exists so that the logic of a gate can be a pure function of a tree and its tests can
// drive it over a small synthetic repository whose expected answers are written out by hand,
// instead of over the real 114-step tree where every expectation would have to be computed
// with the function under test. `scripts/impact-selection.ts` was the first to need that;
// `scripts/step-inventory.ts` and `scripts/step-completeness.ts` are the second and third,
// which is why the interface and its one real implementation moved here.

/** A repository tree, addressed by repository-relative POSIX paths. */
export interface SourceTree {
	/** The file's text, or `null` when it does not exist or is not a file. */
	read: (path: string) => string | null
	/** Names of the direct entries of a directory, or `null` when it is not one. */
	list: (directory: string) => string[] | null
	/** Whether the path is a directory. */
	isDirectory: (path: string) => boolean
}

/**
 * A tree held in memory, from a map of repository-relative path to text.
 *
 * Every directory on the way to a listed file exists; nothing else does. This is what the gate
 * tests are written against: a repository small enough that each expected answer can be written
 * out by hand rather than computed with the function under test.
 */
export function objectTree(files: Record<string, string>): SourceTree {
	const paths = Object.keys(files)
	const directories = new Set<string>()
	for (const path of paths) {
		const parts = path.split('/')
		for (let index = 1; index < parts.length; index++) {
			directories.add(parts.slice(0, index)
				.join('/'))
		}
	}
	return {
		read: path => files[path] ?? null,
		list: (directory) => {
			if (!directories.has(directory))
				return null
			const prefix = `${directory}/`
			const names = new Set<string>()
			for (const path of paths) {
				if (path.startsWith(prefix)) {
					names.add(path.slice(prefix.length)
						.split('/')[0]!)
				}
			}
			return [...names]
		},
		isDirectory: path => directories.has(path),
	}
}

/**
 * The real tree under `rootDirectory`.
 *
 * `path.join` accepts POSIX separators on Windows, so callers keep writing
 * `packages/internal/src/steps` whatever the platform resolves it to.
 */
export function fileSystemTree(rootDirectory: string): SourceTree {
	const resolve = (relative: string): string => path.join(rootDirectory, relative)
	return {
		read: (relative) => {
			try {
				return fs.readFileSync(resolve(relative), 'utf8')
			}
			catch {
				return null
			}
		},
		list: (relative) => {
			try {
				return fs.readdirSync(resolve(relative))
			}
			catch {
				return null
			}
		},
		isDirectory: (relative) => {
			try {
				return fs.statSync(resolve(relative))
					.isDirectory()
			}
			catch {
				return false
			}
		},
	}
}

export interface SourceImportGraph {
	/** Repository-local import/export edges for every file reachable from a root. */
	imports: Map<string, string[]>
	/** Every repository-local file reachable from at least one root, including the roots. */
	reachable: Set<string>
	/** Reachable modules made only of re-export declarations. */
	barrels: Set<string>
	/** Edges the resolver could not prove, so callers can avoid treating the graph as complete. */
	problems: string[]
}

export interface SourceImportGraphOptions {
	/** Customize the unreadable-file diagnostic for a caller-specific graph root. */
	unreadableFile?: (path: string) => string
}

const packagesRoot = 'packages'

function parseSource(path: string, text: string): ts.SourceFile {
	return ts.createSourceFile(path, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS)
}

function moduleSpecifiersOf(path: string, source: ts.SourceFile, problems: string[]): string[] {
	const specifiers: string[] = []

	const visit = (node: ts.Node): void => {
		if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
			const specifier = node.moduleSpecifier
			if (specifier != null) {
				if (ts.isStringLiteral(specifier))
					specifiers.push(specifier.text)
				else
					problems.push(`${path}: an import declaration whose specifier is not a string literal`)
			}
		}
		else if (ts.isImportEqualsDeclaration(node)) {
			problems.push(`${path}: \`import =\` is not resolved by this scan`)
		}
		else if (ts.isCallExpression(node)) {
			const callee = node.expression
			const dynamic = callee.kind === ts.SyntaxKind.ImportKeyword
			const required = ts.isIdentifier(callee) && callee.text === 'require'
			if (dynamic || required) {
				const argument = node.arguments[0]
				if (argument != null && ts.isStringLiteralLike(argument))
					specifiers.push(argument.text)
				else
					problems.push(`${path}: ${dynamic ? 'a dynamic import' : 'a require call'} whose specifier this scan cannot resolve`)
			}
		}
		ts.forEachChild(node, visit)
	}

	ts.forEachChild(source, visit)
	return specifiers
}

function isBarrel(source: ts.SourceFile): boolean {
	return source.statements.length > 0
		&& source.statements.every(statement => ts.isExportDeclaration(statement) && statement.moduleSpecifier != null)
}

function dirname(relative: string): string {
	const index = relative.lastIndexOf('/')
	return index < 0 ? '' : relative.slice(0, index)
}

function normalize(relative: string): string {
	const parts: string[] = []
	for (const part of relative.split('/')) {
		if (part === '' || part === '.')
			continue
		if (part === '..')
			parts.pop()
		else
			parts.push(part)
	}
	return parts.join('/')
}

function workspaceEntries(tree: SourceTree): Map<string, string> {
	const entries = new Map<string, string>()
	for (const directory of tree.list(packagesRoot) ?? []) {
		const manifest = tree.read(`${packagesRoot}/${directory}/package.json`)
		if (manifest == null)
			continue
		const name = (JSON.parse(manifest) as { name?: string }).name
		if (name != null)
			entries.set(name, `${packagesRoot}/${directory}/src/index.ts`)
	}
	return entries
}

function resolveSpecifier(
	tree: SourceTree,
	from: string,
	specifier: string,
	workspace: ReadonlyMap<string, string>,
): string | 'external' | null {
	const workspaceEntry = workspace.get(specifier)
	if (workspaceEntry != null)
		return workspaceEntry
	if (!specifier.startsWith('.'))
		return 'external'

	const base = normalize(`${dirname(from)}/${specifier}`)
	const candidates = [
		base,
		`${base}.ts`,
		`${base}.tsx`,
		`${base}/index.ts`,
		base.endsWith('.js') ? `${base.slice(0, -3)}.ts` : null,
	]
	for (const candidate of candidates) {
		if (candidate != null && !tree.isDirectory(candidate) && tree.read(candidate) != null)
			return candidate
	}
	return null
}

/**
 * Build one repository-local import graph from arbitrary semantic roots. Performance
 * impact and documentation impact share this exact TypeScript/workspace resolution.
 */
export function buildSourceImportGraph(
	tree: SourceTree,
	roots: readonly string[],
	options: SourceImportGraphOptions = {},
): SourceImportGraph {
	const problems: string[] = []
	const workspace = workspaceEntries(tree)
	const imports = new Map<string, string[]>()
	const barrels = new Set<string>()
	const pending = [...new Set(roots)]

	while (pending.length > 0) {
		const sourcePath = pending.pop()!
		if (imports.has(sourcePath))
			continue
		const text = tree.read(sourcePath)
		if (text == null) {
			problems.push(options.unreadableFile?.(sourcePath) ?? `${sourcePath}: reachable from an import root but unreadable`)
			imports.set(sourcePath, [])
			continue
		}

		const source = parseSource(sourcePath, text)
		if (isBarrel(source))
			barrels.add(sourcePath)

		const targets: string[] = []
		for (const specifier of moduleSpecifiersOf(sourcePath, source, problems)) {
			const resolved = resolveSpecifier(tree, sourcePath, specifier, workspace)
			if (resolved === 'external')
				continue
			if (resolved == null) {
				problems.push(`${sourcePath}: cannot resolve '${specifier}'`)
				continue
			}
			targets.push(resolved)
			pending.push(resolved)
		}
		imports.set(sourcePath, targets)
	}

	return {
		imports,
		reachable: new Set(imports.keys()),
		barrels,
		problems,
	}
}

/** Return one causal root → dependency path, or null when the target is unreachable. */
export function importPath(
	graph: Pick<SourceImportGraph, 'imports'>,
	root: string,
	target: string,
): string[] | null {
	if (root === target)
		return graph.imports.has(root) ? [root] : null
	if (!graph.imports.has(root))
		return null

	const previous = new Map<string, string | null>([[root, null]])
	const pending = [root]
	for (let index = 0; index < pending.length; index++) {
		const sourcePath = pending[index]!
		for (const next of graph.imports.get(sourcePath) ?? []) {
			if (previous.has(next))
				continue
			previous.set(next, sourcePath)
			if (next === target) {
				const chain = [target]
				let cursor: string | null = sourcePath
				while (cursor != null) {
					chain.push(cursor)
					cursor = previous.get(cursor) ?? null
				}
				return chain.reverse()
			}
			pending.push(next)
		}
	}
	return null
}
