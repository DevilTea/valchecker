import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('..', import.meta.url))

const forbiddenTitleTerms = [
	'coverage',
	'fast path',
	'fast-path',
	'triggers chaining',
	'loop length',
] as const

const testApiNames = new Set(['describe', 'it', 'suite', 'test'])
const forbiddenTestProperties = new Set(['only', 'skip', 'skipIf', 'todo'])

function importedTestApis(sourceFile: ts.SourceFile): { names: Set<string>, namespaces: Set<string> } {
	const names = new Set<string>()
	const namespaces = new Set<string>()
	for (const statement of sourceFile.statements) {
		if (!ts.isImportDeclaration(statement)
			|| !ts.isStringLiteralLike(statement.moduleSpecifier)
			|| statement.moduleSpecifier.text !== 'vitest'
			|| statement.importClause?.namedBindings == null) {
			continue
		}
		if (ts.isNamespaceImport(statement.importClause.namedBindings)) {
			namespaces.add(statement.importClause.namedBindings.name.text)
			continue
		}
		if (!ts.isNamedImports(statement.importClause.namedBindings))
			continue
		for (const element of statement.importClause.namedBindings.elements) {
			const imported = element.propertyName?.text ?? element.name.text
			if (testApiNames.has(imported)) {
				names.add(element.name.text)
			}
		}
	}
	return { names, namespaces }
}

interface CallChain {
	root: string
	properties: string[]
}

/** Follows `it.skip`, `test.concurrent.skip`, and the `it.each(...)('title', ...)` form. */
function callChain(expression: ts.Expression): CallChain | null {
	if (ts.isIdentifier(expression))
		return { root: expression.text, properties: [] }
	if (ts.isPropertyAccessExpression(expression)) {
		const parent = callChain(expression.expression)
		return parent == null ? null : { root: parent.root, properties: [...parent.properties, expression.name.text] }
	}
	if (ts.isElementAccessExpression(expression)
		&& expression.argumentExpression != null
		&& ts.isStringLiteralLike(expression.argumentExpression)) {
		const parent = callChain(expression.expression)
		return parent == null ? null : { root: parent.root, properties: [...parent.properties, expression.argumentExpression.text] }
	}
	if (ts.isCallExpression(expression))
		return callChain(expression.expression)
	return null
}

function isTestCall(call: ts.CallExpression, importedApis: { names: Set<string>, namespaces: Set<string> }): CallChain | null {
	const chain = callChain(call.expression)
	if (chain == null)
		return null
	// Vitest's globals are supported as well as imports. An imported alias is resolved from the
	// import so an ordinary local helper named `run` cannot become a test API by coincidence.
	const namespaceApi = importedApis.namespaces.has(chain.root) && testApiNames.has(chain.properties[0] ?? '')
	if (!importedApis.names.has(chain.root) && !testApiNames.has(chain.root) && !namespaceApi)
		return null
	if (namespaceApi)
		return { root: chain.properties[0]!, properties: chain.properties.slice(1) }
	return chain
}

export function checkTestQualitySource(source: string, repositoryPath: string): string[] {
	const extension = extname(repositoryPath)
	const sourceFile = ts.createSourceFile(
		repositoryPath,
		source,
		ts.ScriptTarget.Latest,
		true,
		extension.endsWith('tsx') ? ts.ScriptKind.TSX : extension.endsWith('ts') ? ts.ScriptKind.TS : extension.endsWith('jsx') ? ts.ScriptKind.JSX : ts.ScriptKind.JS,
	)
	const failures: string[] = []
	const importedApis = importedTestApis(sourceFile)

	function location(node: ts.Node): string {
		return `${repositoryPath}:${sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1}`
	}

	function visit(node: ts.Node): void {
		if (ts.isCallExpression(node)) {
			const chain = isTestCall(node, importedApis)
			if (chain != null) {
				// `it.skipIf(condition)('title', fn)` is two call nodes. Report the registration
				// call once, rather than reporting the factory and its returned test separately.
				const isSkipIfFactory = chain.properties.includes('skipIf')
					&& ts.isPropertyAccessExpression(node.expression)
					&& ts.isCallExpression(node.parent)
					&& node.parent.expression === node
				if (chain.properties.some(property => forbiddenTestProperties.has(property)) && !isSkipIfFactory)
					failures.push(`${location(node)}: focused, skipped, or todo test`)

				const title = node.arguments[0]
				if (title != null && ts.isStringLiteralLike(title)) {
					const normalized = title.text.toLowerCase()
					for (const term of forbiddenTitleTerms) {
						if (normalized.includes(term))
							failures.push(`${location(node)}: implementation-driven test title contains "${term}"`)
					}
				}
			}
			if (ts.isIdentifier(node.expression)
				&& /^(?:setTimeout|setInterval)$/.test(node.expression.text)) {
				failures.push(`${location(node)}: uncontrolled timer in test`)
			}
		}
		ts.forEachChild(node, visit)
	}

	visit(sourceFile)
	return failures
}

function isTestFile(name: string): boolean {
	return /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(name)
}

async function visit(directory: string, repositoryRoot: string, failures: string[]): Promise<void> {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name)
		if (entry.isDirectory()) {
			if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== 'coverage' && entry.name !== '.git')
				await visit(path, repositoryRoot, failures)
			continue
		}

		const repositoryPath = relative(repositoryRoot, path)
			.replaceAll('\\', '/')
		if (/\.(?:test|spec)\.[cm]?[jt]sx?\.(?:bak|old|orig)$/.test(entry.name)) {
			failures.push(`${repositoryPath}: stale test backup file`)
			continue
		}
		if (!isTestFile(entry.name) || !['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.cts', '.cjs'].includes(extname(path)))
			continue
		failures.push(...checkTestQualitySource(await readFile(path, 'utf8'), repositoryPath))
	}
}

export async function findTestQualityFailures(repositoryRoot = root): Promise<string[]> {
	const failures: string[] = []
	await visit(repositoryRoot, repositoryRoot, failures)
	return failures
}

export async function main(): Promise<void> {
	const failures = await findTestQualityFailures()
	if (failures.length > 0) {
		console.error('Test quality checks failed:')
		for (const failure of failures)
			console.error(`- ${failure}`)
		process.exitCode = 1
	}
	else {
		console.log('Test quality checks passed.')
	}
}

if (process.argv[1] != null && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
	await main()
