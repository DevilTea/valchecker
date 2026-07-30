// The before/after comparison entry point: arguments, files, exit code. The comparison
// itself — aggregation, classification, group trade-offs, coverage, and both reports —
// is in `impact-verdict.mjs`, where a test can drive it without a filesystem.
//
// **Nothing here loads the code under test.** This stage used to build its coverage
// denominators by collecting the cells, which imports every `<name>.bench.ts` under a
// loader that resolves the library to a built dist — so the first sharded CI run measured
// all 245 cells across four shards and then failed here for want of
// `VALCHECKER_DIST_URL`. The variable was not the defect: a stage that reports on two
// builds should not be executing either of them. The catalog is persisted during
// measurement and read as a file, and the scenario catalog of an archived cross-library
// comparison is imported lazily, so this module's static graph is JSON and arithmetic.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseCellCatalog } from './cells/catalog-artifact.mjs'
import { aggregateRuns, compareResults, groupTotalsOf, renderHtml, renderMarkdown } from './impact-verdict.mjs'

const benchmarkRoot = fileURLToPath(new URL('..', import.meta.url))

function parseArguments(argv) {
	const options = {
		baseline: [],
		candidate: [],
		markdown: resolve(benchmarkRoot, 'results/impact.md'),
		json: resolve(benchmarkRoot, 'results/impact.json'),
		html: resolve(benchmarkRoot, 'results/impact.html'),
		failOnRegression: false,
		// Which catalog the coverage denominators come from. The impact gate measures the
		// steps' own bench cells; `scenarios` is kept for reading an archived comparison of
		// the cross-library suite, which is still the unit of `performance-comparison.yml`.
		catalog: 'cells',
		// The persisted cell catalog, written by the measuring job. Required with
		// `--catalog cells`, because the alternative is collecting the cells here.
		cellCatalog: null,
	}
	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index]
		const value = argv[index + 1]
		if (argument === '--baseline' && value) {
			options.baseline.push(resolve(benchmarkRoot, value))
			index++
		}
		else if (argument === '--candidate' && value) {
			options.candidate.push(resolve(benchmarkRoot, value))
			index++
		}
		else if (argument === '--markdown' && value) {
			options.markdown = resolve(benchmarkRoot, value)
			index++
		}
		else if (argument === '--json' && value) {
			options.json = resolve(benchmarkRoot, value)
			index++
		}
		else if (argument === '--html' && value) {
			options.html = resolve(benchmarkRoot, value)
			index++
		}
		else if (argument === '--catalog' && value) {
			if (value !== 'cells' && value !== 'scenarios')
				throw new Error(`Unknown catalog '${value}'; use 'cells' or 'scenarios'.`)
			options.catalog = value
			index++
		}
		else if (argument === '--cell-catalog' && value) {
			options.cellCatalog = resolve(benchmarkRoot, value)
			index++
		}
		else if (argument === '--fail-on-regression') {
			options.failOnRegression = true
		}
		else {
			throw new Error(`Unknown or incomplete argument: ${argument}`)
		}
	}
	if (options.baseline.length !== options.candidate.length)
		throw new Error('Baseline and candidate run counts must match')
	if (options.baseline.length < 3)
		throw new Error('At least three paired baseline and candidate runs are required')
	if (options.catalog === 'cells' && options.cellCatalog == null) {
		throw new Error(
			'--cell-catalog is required with `--catalog cells`. It is the catalog artifact the measuring run wrote; '
			+ 'this stage reads it rather than collecting the cells, which would load the build under test.',
		)
	}
	if (options.catalog === 'scenarios' && options.cellCatalog != null)
		throw new Error('--cell-catalog belongs to `--catalog cells`; a scenario comparison has no cell catalog')
	return options
}

const options = parseArguments(process.argv.slice(2))
// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM benchmark entry script executed to completion at load
const baselineRaw = await Promise.all(options.baseline.map(path => readFile(path, 'utf8')
	.then(JSON.parse)))
// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM benchmark entry script executed to completion at load
const candidateRaw = await Promise.all(options.candidate.map(path => readFile(path, 'utf8')
	.then(JSON.parse)))
const baseline = aggregateRuns(baselineRaw, 'baseline')
const candidate = aggregateRuns(candidateRaw, 'candidate')
// The denominator of every coverage figure: how many rows the group has, per group, in the
// catalog the run was measured against — every cell every step declares, not only the ones
// a scoped run selected, which is what lets a group row say `5/113` rather than `5/5`.
//
// Read from the artifact, and its hash checked against the runs, so the denominators
// provably describe the measured cell set. The scenario catalog is imported here rather
// than at the top of the file so that reading an archived cross-library comparison is the
// only case that loads the scenario registry at all.

const catalog = options.catalog === 'cells'
	// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM entry script executed to completion at load
	? parseCellCatalog(JSON.parse(await readFile(options.cellCatalog, 'utf8')), options.cellCatalog)
	// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM entry script executed to completion at load
	: { catalogHash: null, cells: (await import('./scenarios/index.mjs')).getScenarioCatalog(baseline.mode) }
const groupTotals = groupTotalsOf(catalog.cells)
const result = compareResults(baseline, candidate, { groupTotals, catalogHash: catalog.catalogHash })
// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM benchmark entry script executed to completion at load
await Promise.all([
	mkdir(dirname(options.markdown), { recursive: true }),
	mkdir(dirname(options.json), { recursive: true }),
	mkdir(dirname(options.html), { recursive: true }),
])
// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM benchmark entry script executed to completion at load
await Promise.all([
	writeFile(options.markdown, renderMarkdown(result)),
	writeFile(options.json, `${JSON.stringify(result, null, 2)}\n`),
	writeFile(options.html, renderHtml(result)),
])
console.error(`[benchmark] verdict ${result.verdict} over ${result.coverage.measuredScenarios} of ${result.coverage.tierScenarios} \`${result.mode}\` scenarios`)
// Unconditional, so a clean report says outright that the cell set did not move under it.
console.error(`[benchmark] cells measured ${result.cells.measured} / added ${result.cells.added.length} / removed ${result.cells.removed.length}`)
if (options.failOnRegression && result.verdict === 'regression')
	process.exitCode = 1
