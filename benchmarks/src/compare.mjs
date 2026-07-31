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
		// The static base-versus-head catalog comparison, produced by
		// `scripts/bench-catalog-diff.ts` without executing either build. Optional, because a
		// local comparison of two result files has no refs to diff; absent, the report says so
		// rather than printing zeros for an audit it did not perform.
		catalogDiff: null,
		// Whether a missing catalog diff is a defect. The screen comparison of a pull request
		// audits the contract, so an absent diff there is a wiring failure, not a gap to note in
		// prose: `n/a` is honest but it is not *visible*, and the whole point of the audit is that
		// a deletion cannot reach a merge unseen. A confirmation comparison measures a subset and
		// audits nothing, so it never requires one.
		requireCatalogDiff: false,
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
		else if (argument === '--catalog-diff' && value) {
			options.catalogDiff = resolve(benchmarkRoot, value)
			index++
		}
		else if (argument === '--require-catalog-diff') {
			options.requireCatalogDiff = true
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
	if (options.requireCatalogDiff && options.catalogDiff == null) {
		throw new Error(
			'--require-catalog-diff was given without --catalog-diff. This comparison is supposed to audit the benchmark contract, and without the '
			+ 'static base-versus-head diff it cannot see a deleted or renamed cell at all — the runtime comparison never can, because the apparatus '
			+ 'comes from the candidate ref. Run `pnpm bench:catalog-diff --base <ref> --head <ref> --output <path>` and pass the result.',
		)
	}
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
// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM entry script executed to completion at load
const catalogDiff = options.catalogDiff == null ? null : JSON.parse(await readFile(options.catalogDiff, 'utf8'))
// Existence is not completeness. `--require-catalog-diff` used to be satisfied by a file, so an
// audit that reported itself unable to read a revision still left the gate green — the same class
// of defect as a `removed 0` that could never see a removal. `bench-catalog-diff.ts` already exits
// non-zero on a fatal problem; this refuses the artifact as well, so a diff produced before that
// rule existed, or copied from elsewhere, cannot satisfy the requirement either.
if (options.requireCatalogDiff && (catalogDiff?.fatalProblems ?? []).length > 0) {
	throw new Error(
		`The catalog diff carries ${catalogDiff.fatalProblems.length} problem(s) that make it unusable, so it cannot satisfy --require-catalog-diff: `
		+ `${catalogDiff.fatalProblems.join('; ')}`,
	)
}
const result = compareResults(baseline, candidate, { groupTotals, catalogHash: catalog.catalogHash, catalogDiff })
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
// Unconditional, so a clean report says outright that the cell set did not move under it. The
// catalog counts are `n/a` rather than `0` when no static diff was supplied, because a runtime
// comparison cannot see a deleted cell and must not imply that it did.
console.error(`[benchmark] cells measured ${result.cells.measured}, `
	+ `candidate-only ${result.cells.candidateOnly.length} / baseline-only ${result.cells.baselineOnly.length}`
	// Only a comparison that was given a diff reports catalog movement. Printing `catalog added
	// n/a` from a confirmation comparison — which measures a subset and audits nothing — read as
	// "the audit did not happen" for a run where it had happened in the compare job.
	+ `${result.cells.catalogDiff == null
		? ''
		: `, catalog added ${result.cells.catalogDiff.added.length} / removed ${result.cells.catalogDiff.removed.length}`}`)
if (options.failOnRegression && result.verdict === 'regression')
	process.exitCode = 1
