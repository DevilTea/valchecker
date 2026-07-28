// The before/after comparison entry point: arguments, files, exit code. The comparison
// itself — aggregation, classification, group trade-offs, coverage, and both reports —
// is in `impact-verdict.mjs`, where a test can drive it without a filesystem.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { aggregateRuns, compareResults, groupTotalsOf, renderHtml, renderMarkdown } from './impact-verdict.mjs'
import { getScenarioCatalog } from './scenarios/index.mjs'

const benchmarkRoot = fileURLToPath(new URL('..', import.meta.url))

function parseArguments(argv) {
	const options = {
		baseline: [],
		candidate: [],
		markdown: resolve(benchmarkRoot, 'results/impact.md'),
		json: resolve(benchmarkRoot, 'results/impact.json'),
		html: resolve(benchmarkRoot, 'results/impact.html'),
		failOnRegression: false,
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
// The denominator of every coverage figure: how many scenarios the measured profile has,
// per group, in the checked-out suite — the same copy that measured both sides.
const groupTotals = groupTotalsOf(getScenarioCatalog(baseline.mode))
const result = compareResults(baseline, candidate, { groupTotals })
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
if (options.failOnRegression && result.verdict === 'regression')
	process.exitCode = 1
