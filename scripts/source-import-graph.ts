import type { SourceTree } from './source-tree'
import ts from 'typescript'

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

function parse(path: string, text: string): ts.SourceFile {
	return ts.createSourceFile(path, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS)
}

/**
 * Read import edges from the TypeScript AST rather than scanning text. Dynamic import
 * and CommonJS require calls are supported only when their specifier is a literal; an
 * edge the graph cannot understand is reported instead of silently dropped.
 */
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

function dirname(path: string): string {
	const index = path.lastIndexOf('/')
	return index < 0 ? '' : path.slice(0, index)
}

function normalize(path: string): string {
	const parts: string[] = []
	for (const part of path.split('/')) {
		if (part === '' || part === '.')
			continue
		if (part === '..')
			parts.pop()
		else
			parts.push(part)
	}
	return parts.join('/')
}

/** Workspace package names resolve to their source entry, never to built declarations. */
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
 * Build one repository-local import graph from arbitrary semantic roots. The graph is
 * deliberately independent of benchmarks or documentation so both systems share the
 * same TypeScript edge semantics and workspace resolution.
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
		const path = pending.pop()!
		if (imports.has(path))
			continue
		const text = tree.read(path)
		if (text == null) {
			problems.push(options.unreadableFile?.(path) ?? `${path}: reachable from an import root but unreadable`)
			imports.set(path, [])
			continue
		}

		const source = parse(path, text)
		if (isBarrel(source))
			barrels.add(path)

		const targets: string[] = []
		for (const specifier of moduleSpecifiersOf(path, source, problems)) {
			const resolved = resolveSpecifier(tree, path, specifier, workspace)
			if (resolved === 'external')
				continue
			if (resolved == null) {
				problems.push(`${path}: cannot resolve '${specifier}'`)
				continue
			}
			targets.push(resolved)
			pending.push(resolved)
		}
		imports.set(path, targets)
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
		const path = pending[index]!
		for (const next of graph.imports.get(path) ?? []) {
			if (previous.has(next))
				continue
			previous.set(next, path)
			if (next === target) {
				const chain = [target]
				let cursor: string | null = path
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
