import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = resolve(import.meta.dirname, '..')
const expectedPath = resolve(root, 'api-surface.json')
const artifactDirectory = resolve(root, 'artifacts')
const actualPath = resolve(artifactDirectory, 'api-surface.actual.json')
const errorPath = resolve(artifactDirectory, 'api-surface.error.txt')

const packages = {
	'@valchecker/internal': resolve(root, 'packages/internal/dist/index'),
	'@valchecker/all-steps': resolve(root, 'packages/all-steps/dist/index'),
	'valchecker': resolve(root, 'packages/valchecker/dist/index'),
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
	const checker = program.getTypeChecker()
	const source = program.getSourceFile(declarationPath)
	const moduleSymbol = source ? checker.getSymbolAtLocation(source) : undefined
	if (!moduleSymbol)
		throw new Error(`Unable to load declaration entrypoint: ${declarationPath}`)

	const values = new Set<string>()
	const typeOnly = new Set<string>()

	for (const exported of checker.getExportsOfModule(moduleSymbol)) {
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
	const entries = await Promise.all(Object.entries(packages)
		.map(async ([name, entry]) => {
			const module = await import(pathToFileURL(`${entry}.mjs`).href)
			const declarations = getDeclarationSurface(`${entry}.d.mts`)
			return [name, {
				runtime: sortNames(Object.keys(module)),
				...declarations,
			}] as const
		}))

	return Object.fromEntries(entries) as ApiSurface
}

function assertRuntimeDeclarationsMatch(surface: ApiSurface): void {
	for (const [name, packageSurface] of Object.entries(surface)) {
		if (JSON.stringify(packageSurface.runtime) !== JSON.stringify(packageSurface.declaredValues)) {
			throw new Error([
				`${name} runtime and declaration value exports differ.`,
				`Runtime: ${packageSurface.runtime.join(', ')}`,
				`Declarations: ${packageSurface.declaredValues.join(', ')}`,
			].join('\n'))
		}
	}
}

async function main(): Promise<void> {
	await mkdir(artifactDirectory, { recursive: true })
	const actual = await getApiSurface()
	const serialized = `${JSON.stringify(actual, null, '\t')}\n`
	await writeFile(actualPath, serialized)
	assertRuntimeDeclarationsMatch(actual)

	if (process.argv.includes('--write')) {
		await writeFile(expectedPath, serialized)
		console.log(`Updated ${expectedPath}`)
		return
	}

	const expected = JSON.parse(await readFile(expectedPath, 'utf8')) as ApiSurface
	if (JSON.stringify(expected) !== JSON.stringify(actual)) {
		console.error(`Public API surface changed. Review ${actualPath} and run \`pnpm api:surface:update\` when the change is intentional.`)
		process.exitCode = 1
	}
	else {
		console.log('Public runtime and type export surfaces match api-surface.json.')
	}
}

try {
	await main()
}
catch (error) {
	await mkdir(dirname(errorPath), { recursive: true })
	const diagnostic = error instanceof Error ? error.stack ?? error.message : String(error)
	await writeFile(errorPath, `${diagnostic}\n`)
	throw error
}
