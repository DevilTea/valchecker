import { spawnSync } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

interface TypePerformanceMetrics {
	files: number
	types: number
	instantiations: number
	memoryKib: number
	checkSeconds: number
	totalSeconds: number
}

interface TypePerformanceBudget {
	typescript: string
	maximum: Pick<TypePerformanceMetrics, 'types' | 'instantiations' | 'memoryKib'>
}

const root = fileURLToPath(new URL('..', import.meta.url))
const generatedRoot = join(root, 'artifacts', 'type-performance', 'generated')
const budgetPath = join(root, 'type-performance', 'budget.json')
const summaryPath = join(root, 'artifacts', 'type-performance', 'summary.md')
const metricsPath = join(root, 'artifacts', 'type-performance', 'metrics.json')

function createFixture(): string {
	const requiredFields = Array.from({ length: 80 }, (_, index) => {
		if (index % 3 === 0)
			return `field${index}: v.string().toTrimmed().isLengthAtLeast(1)`
		if (index % 3 === 1)
			return `field${index}: v.number().isFinite().isInteger()`
		return `field${index}: v.boolean()`
	}).join(',\n\t')
	const optionalFields = Array.from({ length: 40 }, (_, index) => `optional${index}: [v.string().toLowercase()]`).join(',\n\t')
	const unionBranches = Array.from({ length: 40 }, (_, index) => `'status-${index}'`).join(', ')
	const variants = Array.from({ length: 30 }, (_, index) => `
		variant${index}: v.object({
			type: v.literal('variant${index}'),
			value: v.number().isFinite(),
			label: [v.string().toTrimmed()],
		}),`).join('')
	const chain = Array.from({ length: 12 }, () => '.toTrimmed().toLowercase().isLengthAtLeast(1).isLengthAtMost(256)').join('')
	let nested = 'v.string().toTrimmed()'
	for (let index = 0; index < 12; index++)
		nested = `v.object({ level${index}: ${nested}, optional${index}: [v.number().isFinite()] })`

	return `import { v } from 'valchecker'
import type { InferInput, InferIssue, InferOutput } from '@valchecker/internal'

export const largeObject = v.object({
	${requiredFields},
	${optionalFields},
})

export const largeUnion = v.union([${unionBranches}])

export const largeVariant = v.variant({
	discriminator: 'type',
	variants: {${variants}
	},
})

export const deepObject = ${nested}
export const longChain = v.string()${chain}

export type LargeObjectInput = InferInput<typeof largeObject>
export type LargeObjectOutput = InferOutput<typeof largeObject>
export type LargeObjectIssue = InferIssue<typeof largeObject>
export type LargeUnionOutput = InferOutput<typeof largeUnion>
export type LargeVariantOutput = InferOutput<typeof largeVariant>
export type DeepObjectOutput = InferOutput<typeof deepObject>
export type LongChainIssue = InferIssue<typeof longChain>

declare const objectInput: LargeObjectInput
declare const objectOutput: LargeObjectOutput
declare const objectIssue: LargeObjectIssue
declare const unionOutput: LargeUnionOutput
declare const variantOutput: LargeVariantOutput
declare const deepOutput: DeepObjectOutput
declare const chainIssue: LongChainIssue

void [objectInput, objectOutput, objectIssue, unionOutput, variantOutput, deepOutput, chainIssue]
`
}

function createTsconfig(): string {
	return `${JSON.stringify({
		compilerOptions: {
			target: 'ES2023',
			module: 'ESNext',
			moduleResolution: 'Bundler',
			strict: true,
			exactOptionalPropertyTypes: true,
			noEmit: true,
			skipLibCheck: true,
			baseUrl: '../../..',
			paths: {
				valchecker: ['packages/valchecker/src/index.ts'],
				'@valchecker/all-steps': ['packages/all-steps/src/index.ts'],
				'@valchecker/internal': ['packages/internal/src/index.ts'],
			},
		},
		files: ['fixture.ts'],
	}, null, 2)}\n`
}

function parseNumber(output: string, label: string): number {
	const match = output.match(new RegExp(`^${label}:\\s+([0-9.]+)(?:K|s)?$`, 'm'))
	if (match == null)
		throw new Error(`Missing TypeScript diagnostic metric: ${label}`)
	return Number(match[1])
}

function parseMetrics(output: string): TypePerformanceMetrics {
	return {
		files: parseNumber(output, 'Files'),
		types: parseNumber(output, 'Types'),
		instantiations: parseNumber(output, 'Instantiations'),
		memoryKib: parseNumber(output, 'Memory used'),
		checkSeconds: parseNumber(output, 'Check time'),
		totalSeconds: parseNumber(output, 'Total time'),
	}
}

async function readBudget(): Promise<TypePerformanceBudget | undefined> {
	try {
		return JSON.parse(await readFile(budgetPath, 'utf8')) as TypePerformanceBudget
	}
	catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT')
			return undefined
		throw error
	}
}

function markdown(metrics: TypePerformanceMetrics, budget: TypePerformanceBudget | undefined, typescript: string, failures: string[]): string {
	const rows = [
		['Files', metrics.files.toLocaleString('en-US'), 'report only'],
		['Types', metrics.types.toLocaleString('en-US'), budget?.maximum.types.toLocaleString('en-US') ?? 'baseline pending'],
		['Instantiations', metrics.instantiations.toLocaleString('en-US'), budget?.maximum.instantiations.toLocaleString('en-US') ?? 'baseline pending'],
		['Memory', `${metrics.memoryKib.toLocaleString('en-US')} KiB`, budget == null ? 'baseline pending' : `${budget.maximum.memoryKib.toLocaleString('en-US')} KiB`],
		['Check time', `${metrics.checkSeconds.toFixed(2)} s`, 'report only'],
		['Total time', `${metrics.totalSeconds.toFixed(2)} s`, 'report only'],
	]
	const status = failures.length === 0 ? 'passed' : 'failed'
	return `# Type performance\n\n**${status.toUpperCase()}** with TypeScript ${typescript}.\n\n| Metric | Observed | Budget |\n| --- | ---: | ---: |\n${rows.map(row => `| ${row.join(' | ')} |`).join('\n')}\n\n${budget == null ? 'No committed budget exists yet. Commit the generated metrics as the initial reviewed baseline before marking this pull request ready.\n' : failures.length === 0 ? 'All deterministic compiler-complexity metrics are within budget. Wall-clock timings are reported but intentionally not gated on shared runners.\n' : `## Regressions\n\n${failures.map(failure => `- ${failure}`).join('\n')}\n`}\n`
}

await rm(generatedRoot, { force: true, recursive: true })
await mkdir(generatedRoot, { recursive: true })
await writeFile(join(generatedRoot, 'fixture.ts'), createFixture())
await writeFile(join(generatedRoot, 'tsconfig.json'), createTsconfig())

const typescriptPackage = JSON.parse(await readFile(join(root, 'node_modules', 'typescript', 'package.json'), 'utf8')) as { version: string }
const tscPath = join(root, 'node_modules', 'typescript', 'bin', 'tsc')
const result = spawnSync(process.execPath, [
	tscPath,
	'--project',
	join(generatedRoot, 'tsconfig.json'),
	'--extendedDiagnostics',
	'--pretty',
	'false',
], {
	cwd: root,
	encoding: 'utf8',
})
const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
if (result.status !== 0) {
	process.stderr.write(output)
	process.exitCode = result.status ?? 1
}
else {
	const metrics = parseMetrics(output)
	const budget = await readBudget()
	const failures: string[] = []
	if (budget != null) {
		if (budget.typescript !== typescriptPackage.version)
			failures.push(`budget targets TypeScript ${budget.typescript}, but the workspace uses ${typescriptPackage.version}`)
		for (const metric of ['types', 'instantiations', 'memoryKib'] as const) {
			if (metrics[metric] > budget.maximum[metric])
				failures.push(`${metric} ${metrics[metric]} exceeds ${budget.maximum[metric]}`)
		}
	}

	await mkdir(join(root, 'artifacts', 'type-performance'), { recursive: true })
	await writeFile(metricsPath, `${JSON.stringify({ typescript: typescriptPackage.version, metrics }, null, 2)}\n`)
	await writeFile(summaryPath, markdown(metrics, budget, typescriptPackage.version, failures))
	process.stdout.write(await readFile(summaryPath, 'utf8'))
	if (budget == null)
		process.stdout.write(`Initial baseline candidate: ${JSON.stringify({ typescript: typescriptPackage.version, maximum: metrics })}\n`)
	if (failures.length > 0)
		process.exitCode = 1
}
