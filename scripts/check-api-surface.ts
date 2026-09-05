import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
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

export interface PackageSurface {
	runtime: string[]
	declaredValues: string[]
	typeOnly: string[]
	/** The declaration text owned by each public export, including its signature. */
	declarationSignatures: Record<string, string>
}

export type ApiSurface = Record<keyof typeof packages, PackageSurface>

function sortNames(names: Iterable<string>): string[] {
	return [...names].sort((a, b) => a.localeCompare(b))
}

export function getDeclarationSurface(declarationPath: string): Pick<PackageSurface, 'declaredValues' | 'typeOnly' | 'declarationSignatures'> {
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
	const declarationSignatures: Record<string, string> = {}

	for (const exported of checker.getExportsOfModule(moduleSymbol)) {
		const symbol = exported.flags & ts.SymbolFlags.Alias
			? checker.getAliasedSymbol(exported)
			: exported
		const name = exported.getName()
		if (symbol.flags & ts.SymbolFlags.Value)
			values.add(name)
		else
			typeOnly.add(name)
		const declarations = symbol.declarations
		if (declarations == null || declarations.length === 0)
			throw new Error(`Unable to load declaration for public export '${name}' from ${declarationPath}`)
		declarationSignatures[name] = declarations
			.map(declaration => declaration.getText(declaration.getSourceFile()))
			.join('\n')
	}

	return {
		declaredValues: sortNames(values),
		typeOnly: sortNames(typeOnly),
		declarationSignatures: Object.fromEntries(Object.entries(declarationSignatures)
			.sort(([left], [right]) => left.localeCompare(right))),
	}
}

/** Compare the checked-in API artifact without reducing a declaration change to an export rename. */
export function apiSurfaceDifferences(expected: ApiSurface, actual: ApiSurface): string[] {
	const differences: string[] = []
	for (const name of Object.keys(packages) as (keyof typeof packages)[]) {
		const expectedPackage = expected[name]
		const actualPackage = actual[name]
		if (expectedPackage == null || actualPackage == null) {
			differences.push(`${name} package surface is missing`)
			continue
		}
		if (JSON.stringify(expectedPackage.runtime) !== JSON.stringify(actualPackage.runtime))
			differences.push(`${name} runtime exports changed`)
		if (JSON.stringify(expectedPackage.declaredValues) !== JSON.stringify(actualPackage.declaredValues))
			differences.push(`${name} declared value exports changed`)
		if (JSON.stringify(expectedPackage.typeOnly) !== JSON.stringify(actualPackage.typeOnly))
			differences.push(`${name} type-only exports changed`)
		for (const exportName of new Set([
			...Object.keys(expectedPackage.declarationSignatures),
			...Object.keys(actualPackage.declarationSignatures),
		])) {
			if (expectedPackage.declarationSignatures[exportName] !== actualPackage.declarationSignatures[exportName])
				differences.push(`${name} declaration signature changed for '${exportName}'`)
		}
	}
	return differences
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
	const differences = apiSurfaceDifferences(expected, actual)
	if (differences.length > 0) {
		console.error(`Public API surface changed. Review ${actualPath} and run \`pnpm api:surface:update\` when the change is intentional.`)
		console.error(differences.join('\n'))
		process.exitCode = 1
	}
	else {
		console.log('Public runtime and type export surfaces match api-surface.json.')
	}
}

if (process.argv[1] != null && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		await main()
	}
	catch (error) {
		await mkdir(dirname(errorPath), { recursive: true })
		const diagnostic = error instanceof Error ? error.stack ?? error.message : String(error)
		await writeFile(errorPath, `${diagnostic}\n`)
		throw error
	}
}
