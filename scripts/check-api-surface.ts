import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = resolve(import.meta.dirname, '..')
const expectedPath = resolve(root, 'api-surface.json')
const actualPath = resolve(root, 'artifacts/api-surface.actual.json')

const packages = {
	'@valchecker/internal': resolve(root, 'packages/internal/dist/index'),
	'@valchecker/all-steps': resolve(root, 'packages/all-steps/dist/index'),
	valchecker: resolve(root, 'packages/valchecker/dist/index'),
} as const

interface PackageSurface {
	runtime: string[]
	declaredValues: string[]
	typeOnly: string[]
}

type ApiSurface = Record<keyof typeof packages, PackageSurface>

function sortNames(names: Iterable<string>): string[] {
	return [...names].sort((a, b) => a.localeCompare(b))
}

function getDeclarationSurface(declarationPath: string): Pick<PackageSurface, 'declaredValues' | 'typeOnly'> {
	const program = ts.createProgram({
		rootNames: [declarationPath],
		options: {
			module: ts.ModuleKind.NodeNext,
			moduleResolution: ts.ModuleResolutionKind.NodeNext,
			target: ts.ScriptTarget.ESNext,
			skipLibCheck: true,
		},
	})
	const source = program.getSourceFile(declarationPath)
	if (!source?.symbol)
		throw new Error(`Unable to load declaration entrypoint: ${declarationPath}`)

	const checker = program.getTypeChecker()
	const values = new Set<string>()
	const typeOnly = new Set<string>()

	for (const exported of checker.getExportsOfModule(source.symbol)) {
		const symbol = exported.flags & ts.SymbolFlags.Alias
			? checker.getAliasedSymbol(exported)
			: exported
		const name = exported.getName()
		if (symbol.flags & ts.SymbolFlags.Value)
			values.add(name)
		else
			typeOnly.add(name)
	}

	return {
		declaredValues: sortNames(values),
		typeOnly: sortNames(typeOnly),
	}
}

async function getApiSurface(): Promise<ApiSurface> {
	const entries = await Promise.all(Object.entries(packages).map(async ([name, entry]) => {
		const module = await import(pathToFileURL(`${entry}.mjs`).href)
		const declarations = getDeclarationSurface(`${entry}.d.mts`)
		const runtime = sortNames(Object.keys(module))

		if (JSON.stringify(runtime) !== JSON.stringify(declarations.declaredValues)) {
			throw new Error([
				`${name} runtime and declaration value exports differ.`,
				`Runtime: ${runtime.join(', ')}`,
				`Declarations: ${declarations.declaredValues.join(', ')}`,
			].join('\n'))
		}

		return [name, { runtime, ...declarations }] as const
	}))

	return Object.fromEntries(entries) as ApiSurface
}

const actual = await getApiSurface()
const serialized = `${JSON.stringify(actual, null, '\t')}\n`
await mkdir(dirname(actualPath), { recursive: true })
await writeFile(actualPath, serialized)

if (process.argv.includes('--write')) {
	await writeFile(expectedPath, serialized)
	console.log(`Updated ${expectedPath}`)
}
else {
	const expected = await readFile(expectedPath, 'utf8')
	if (expected !== serialized) {
		console.error(`Public API surface changed. Review ${actualPath} and run \`pnpm api:surface:update\` when the change is intentional.`)
		process.exitCode = 1
	}
	else {
		console.log('Public runtime and type export surfaces match api-surface.json.')
	}
}
