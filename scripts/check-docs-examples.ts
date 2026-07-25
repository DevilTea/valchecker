import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'

// Compiles the TypeScript examples in `docs/` against the built declarations, so a rename or a
// signature change cannot leave the documentation quietly describing an API that no longer
// exists. VitePress renders fenced code without type-checking it, and `docs/` does not depend on
// `valchecker`, so nothing else covers this.
//
// A page compiles as one module whose fences are nested scopes, which is how a page reads: each
// example may use the bindings the ones above it introduced (`const v = createValchecker(…)` above
// a run of `v.…()` examples), and may also redeclare a name it reuses per example (`schema`,
// `result`) — legal shadowing in a nested scope. Imports from every fence are merged into one
// statement per module, since pages repeat them in varying groupings.
//
// Three directives control what is compiled, each placed on the line before a fence:
//
//   <!-- typecheck-skip -->      exclude this fence — a deliberate fragment, an example of an old
//                                API, or an import of a module the reader is expected to create
//   <!-- typecheck-isolate -->   compile this fence as its own module, so a self-contained setup
//                                example does not impose its bindings on the rest of the page
//   <!-- typecheck-prelude       declare names the page only uses illustratively; a declaration
//   declare const input: unknown yields automatically in any module that imports that name for real
//   -->

const root = process.cwd()
const docsRoot = path.join(root, 'docs')
const outputRoot = path.join(root, 'artifacts/docs-examples')
const distributions = {
	'valchecker': 'packages/valchecker/dist/index.d.mts',
	'@valchecker/internal': 'packages/internal/dist/index.d.mts',
	'@valchecker/all-steps': 'packages/all-steps/dist/index.d.mts',
} as const

interface Fence {
	/** 1-based line of the fence's first code line in the Markdown file. */
	startLine: number
	text: string
	/** Compiled as its own module, so its bindings do not leak into the rest of the page. */
	isolated: boolean
}

interface Chunk {
	text: string
	sourceLine: number
}

interface Page {
	source: string
	/** Distinguishes the modules a single Markdown file produces. */
	moduleId: string
	generated: string
	/** Generated line number -> Markdown line number. */
	lineMap: Map<number, number>
}

function markdownFiles(directory: string): string[] {
	const found: string[] = []
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		if (entry.name === 'node_modules' || entry.name === '.vitepress' || entry.name === 'dist')
			continue
		const entryPath = path.join(directory, entry.name)
		if (entry.isDirectory())
			found.push(...markdownFiles(entryPath))
		else if (entry.name.endsWith('.md'))
			found.push(entryPath)
	}
	return found.sort()
}

function readDirectivesAndFences(lines: string[]): { fences: Fence[], prelude: string[] } {
	const fences: Fence[] = []
	const prelude: string[] = []
	let skipNext = false
	let isolateNext = false
	let index = 0

	while (index < lines.length) {
		const trimmed = lines[index]!.trim()

		if (trimmed === '<!-- typecheck-skip -->') {
			skipNext = true
			index++
			continue
		}

		if (trimmed === '<!-- typecheck-isolate -->') {
			isolateNext = true
			index++
			continue
		}

		if (trimmed === '<!-- typecheck-prelude') {
			index++
			while (index < lines.length && lines[index]!.trim() !== '-->') {
				prelude.push(lines[index]!)
				index++
			}
			index++
			continue
		}

		const opener = /^(`{3,})(ts|tsx)(?:\s|$)/.exec(trimmed)
		if (opener == null) {
			index++
			continue
		}

		const closing = opener[1]!
		const startLine = index + 2
		index++
		const body: string[] = []
		while (index < lines.length && lines[index]!.trim() !== closing) {
			body.push(lines[index]!)
			index++
		}
		index++

		if (skipNext)
			skipNext = false
		else if (body.length > 0)
			fences.push({ startLine, text: body.join('\n'), isolated: isolateNext })
		isolateNext = false
	}

	return { fences, prelude }
}

function declaredNames(statement: ts.Statement): string[] {
	if (ts.isVariableStatement(statement)) {
		return statement.declarationList.declarations
			.map(declaration => ts.isIdentifier(declaration.name) ? declaration.name.text : undefined)
			.filter((name): name is string => name != null)
	}
	if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name != null)
		return [statement.name.text]
	if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isEnumDeclaration(statement))
		return [statement.name.text]
	return []
}

interface ParsedFence {
	startLine: number
	source: ts.SourceFile
	statements: readonly ts.Statement[]
}

interface ImportBindings {
	/** Named value bindings, as written (`isFinite`, `v as instance`). */
	values: Set<string>
	/** Named type-only bindings. */
	types: Set<string>
	/** Anything else (default, namespace, side-effect only), deduplicated verbatim. */
	verbatim: Set<string>
}

/**
 * Pages import the same names repeatedly across fences, in different groupings and orders. Merging
 * every import into one statement per module removes those duplicates outright, which flat text
 * deduplication cannot do.
 */
function collectImports(statement: ts.ImportDeclaration, source: ts.SourceFile, modules: Map<string, ImportBindings>): void {
	const specifier = statement.moduleSpecifier.getText(source)
	const bindings = modules.get(specifier) ?? { values: new Set(), types: new Set(), verbatim: new Set() }
	modules.set(specifier, bindings)

	const clause = statement.importClause
	if (clause == null || clause.name != null || clause.namedBindings == null || !ts.isNamedImports(clause.namedBindings)) {
		bindings.verbatim.add(statement.getText(source))
		return
	}

	for (const element of clause.namedBindings.elements) {
		const text = element.getText(source)
		if (clause.isTypeOnly || element.isTypeOnly)
			bindings.types.add(text.replace(/^type\s+/, ''))
		else
			bindings.values.add(text)
	}
}

function renderImports(modules: Map<string, ImportBindings>): string[] {
	const rendered: string[] = []
	for (const [specifier, bindings] of modules) {
		for (const text of bindings.verbatim)
			rendered.push(text)
		if (bindings.types.size > 0) {
			rendered.push(`import type { ${[...bindings.types].sort()
				.join(', ')} } from ${specifier}`)
		}
		if (bindings.values.size > 0) {
			rendered.push(`import { ${[...bindings.values].sort()
				.join(', ')} } from ${specifier}`)
		}
	}
	return rendered
}

function assemble(source: string, moduleId: string, fences: ParsedFence[], prelude: string[]): Page | undefined {
	const modules = new Map<string, ImportBindings>()
	const declaredOnPage = new Set<string>()
	const bodies: Chunk[][] = []

	function chunkOf(fence: ParsedFence, statement: ts.Statement): Chunk {
		const text = statement.getText(fence.source)
		const line = fence.source.getLineAndCharacterOfPosition(statement.getStart(fence.source)).line
		return { text, sourceLine: fence.startLine + line }
	}

	for (const fence of fences) {
		const body: Chunk[] = []
		for (const statement of fence.statements) {
			if (ts.isImportDeclaration(statement)) {
				collectImports(statement, fence.source, modules)
				continue
			}

			const chunk = chunkOf(fence, statement)
			if (ts.isImportEqualsDeclaration(statement)) {
				const bindings = modules.get('\'\'') ?? { values: new Set(), types: new Set(), verbatim: new Set() }
				modules.set('\'\'', bindings)
				bindings.verbatim.add(chunk.text)
				continue
			}

			for (const name of declaredNames(statement))
				declaredOnPage.add(name)
			body.push(chunk)
		}
		bodies.push(body)
	}

	const output: string[] = []
	const lineMap = new Map<number, number>()

	function emit(chunk: Chunk): void {
		// Plugin-authoring examples export what they define, but `export` is illegal inside a block.
		// Dropping the modifier leaves the declaration itself — and so its type checking — intact.
		const lines = chunk.text.replace(/^export (?=(?:declare |abstract )?(?:const|let|var|function|class|type|interface|enum|async)\b)/, '')
			.split('\n')
		for (const text of lines) {
			output.push(text)
			lineMap.set(output.length, chunk.sourceLine)
		}
	}

	const importLines = renderImports(modules)

	// A prelude covers names a page elides, but one page's fences are not uniform: an example that
	// does show the import must not collide with the prelude's stand-in for it. So a prelude
	// declaration yields whenever this module already provides that name for real.
	const provided = new Set<string>(declaredOnPage)
	for (const line of importLines) {
		for (const name of /\{([^}]*)\}/.exec(line)?.[1]?.split(',') ?? []) {
			provided.add(name.trim()
				.split(/\s+as\s+/)
				.at(-1)!.trim())
		}
	}
	for (const statement of ts.createSourceFile('prelude.ts', prelude.join('\n'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS).statements) {
		const names = declaredNames(statement)
		if (names.length > 0 && names.every(name => provided.has(name)))
			continue
		output.push(statement.getFullText()
			.trim())
	}

	// The documentation site treats the default instance as ambient: reference pages call `v.…()`
	// the way a reader would in a project that already set it up.
	const usesInstance = bodies.flat()
		.some(chunk => /\bv\./.test(chunk.text))
	if (usesInstance && !provided.has('v'))
		output.push('import { v } from \'valchecker\'')

	for (const line of importLines)
		output.push(line)

	// Fences nest instead of sitting side by side, which is how a page reads: each example may use
	// the bindings the ones above it introduced, and may also redeclare a name like `schema` or
	// `result` — legal shadowing in a nested scope, a redeclaration error in a sibling one.
	for (const body of bodies) {
		output.push('{')
		for (const chunk of body)
			emit(chunk)
	}
	for (let depth = 0; depth < bodies.length; depth++)
		output.push('}')

	if (lineMap.size === 0)
		return undefined

	// Without an import or export a generated file is a global script, not a module, and its
	// top-level declarations then collide with every other script in the program.
	output.push('export {}')

	return { source, moduleId, generated: output.join('\n'), lineMap }
}

function buildPages(filePath: string): Page[] {
	const lines = fs.readFileSync(filePath, 'utf8')
		.split('\n')
	const { fences, prelude } = readDirectivesAndFences(lines)
	if (fences.length === 0)
		return []

	const parsed = fences.map((fence) => {
		const source = ts.createSourceFile('fence.ts', fence.text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
		return { fence, parsed: { startLine: fence.startLine, source, statements: source.statements } }
	})

	const relative = path.relative(root, filePath)
	const shared = parsed.filter(entry => !entry.fence.isolated)
		.map(entry => entry.parsed)
	const isolated = parsed.filter(entry => entry.fence.isolated)
		.map(entry => entry.parsed)

	const pages: Page[] = []
	const sharedPage = assemble(relative, 'page', shared, prelude)
	if (sharedPage != null)
		pages.push(sharedPage)
	for (const fence of isolated) {
		const page = assemble(relative, `isolated-${fence.startLine}`, [fence], prelude)
		if (page != null)
			pages.push(page)
	}
	return pages
}

for (const [specifier, distribution] of Object.entries(distributions)) {
	if (!fs.existsSync(path.join(root, distribution)))
		throw new Error(`${distribution} is missing; run \`pnpm build\` before checking documentation examples (${specifier})`)
}

const pages: Page[] = []
for (const filePath of markdownFiles(docsRoot))
	pages.push(...buildPages(filePath))

if (pages.length === 0)
	throw new Error('No TypeScript examples were found under docs/; the extractor is probably broken')

fs.rmSync(outputRoot, { recursive: true, force: true })
fs.mkdirSync(outputRoot, { recursive: true })

const generatedToPage = new Map<string, Page>()
for (const page of pages) {
	const base = page.source.replace(/[/\\]/g, '__')
		.replace(/\.md$/, '')
	const generatedPath = path.join(outputRoot, `${base}.${page.moduleId}.ts`)
	fs.writeFileSync(generatedPath, `${page.generated}\n`)
	generatedToPage.set(path.resolve(generatedPath), page)
}

const program = ts.createProgram({
	rootNames: [...generatedToPage.keys()],
	options: {
		strict: true,
		noEmit: true,
		skipLibCheck: true,
		target: ts.ScriptTarget.ESNext,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		lib: ['lib.esnext.d.ts', 'lib.dom.d.ts'],
		types: [],
		baseUrl: root,
		paths: Object.fromEntries(
			Object.entries(distributions)
				.map(([specifier, distribution]) => [specifier, [distribution]]),
		),
	},
})

const diagnostics = [
	...program.getSyntacticDiagnostics(),
	...program.getSemanticDiagnostics(),
]

if (diagnostics.length === 0) {
	console.log(`Documentation examples compile (${pages.length} pages).`)
}
else {
	const formatted = diagnostics.map((diagnostic) => {
		const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')
		const page = diagnostic.file == null ? undefined : generatedToPage.get(path.resolve(diagnostic.file.fileName))
		if (page == null || diagnostic.start == null)
			return `docs: TS${diagnostic.code}: ${message}`

		const generatedLine = diagnostic.file!.getLineAndCharacterOfPosition(diagnostic.start).line + 1
		const sourceLine = page.lineMap.get(generatedLine)
		const location = sourceLine == null ? page.source : `${page.source}:${sourceLine}`
		return `${location}: TS${diagnostic.code}: ${message}`
	})

	console.error([...new Set(formatted)].sort()
		.join('\n'))
	console.error(`\nGenerated modules kept in ${path.relative(root, outputRoot)} for inspection.`)
	process.exitCode = 1
}
