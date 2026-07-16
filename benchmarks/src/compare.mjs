import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const benchmarkRoot = fileURLToPath(new URL('..', import.meta.url))
const stabilityThreshold = 5
const meaningfulThreshold = 5
const severeScenarioRegression = -10
const severeCategoryRegression = -5

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
	if (options.baseline.length === 0 || options.candidate.length === 0)
		throw new Error('At least one --baseline and --candidate are required')
	return options
}

function median(values) {
	const sorted = [...values].sort((left, right) => left - right)
	const middle = Math.floor(sorted.length / 2)
	return sorted.length % 2 === 0
		? (sorted[middle - 1] + sorted[middle]) / 2
		: sorted[middle]
}

function mean(values) {
	return values.reduce((total, value) => total + value, 0) / values.length
}

function relativeMarginOfError(values, fallback) {
	if (values.length < 2)
		return fallback
	const average = mean(values)
	const variance = values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1)
	return average === 0
		? 0
		: 1.96 * Math.sqrt(variance) / Math.sqrt(values.length) / average * 100
}

function getValchecker(raw, label) {
	if (!raw || typeof raw !== 'object' || !Array.isArray(raw.libraries))
		throw new TypeError(`${label} benchmark result is invalid`)
	const library = raw.libraries.find(item => item.adapter === 'valchecker')
	if (!library)
		throw new Error(`${label} result does not contain valchecker`)
	return library
}

function aggregateRuns(raws, label) {
	const mode = raws[0].mode
	const first = getValchecker(raws[0], label)
	const resultMaps = raws.map((raw, index) => {
		if (raw.mode !== mode)
			throw new Error(`${label} run ${index + 1} mode differs`)
		return new Map(getValchecker(raw, `${label} run ${index + 1}`).results.map(result => [result.scenario, result]))
	})

	const results = first.results.map((template) => {
		const runResults = resultMaps.map((resultMap) => {
			const result = resultMap.get(template.scenario)
			if (!result)
				throw new Error(`${label} run is missing ${template.scenario}`)
			if (result.category !== template.category)
				throw new Error(`${label} category mismatch for ${template.scenario}`)
			return result
		})
		const runMedians = runResults.map(result => result.medianOpsPerSecond)
		return {
			scenario: template.scenario,
			category: template.category,
			medianOpsPerSecond: median(runMedians),
			relativeMarginOfError: relativeMarginOfError(runMedians, runResults[0].relativeMarginOfError),
			runMedians,
			withinRunRme: runResults.map(result => result.relativeMarginOfError),
		}
	})

	return {
		mode,
		runCount: raws.length,
		commits: [...new Set(raws.map(raw => raw.environment?.commit ?? null))],
		results,
	}
}

function geometricMean(values) {
	if (values.length === 0)
		return null
	return Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length)
}

function formatDelta(value) {
	const percentage = value * 100
	return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(1)}%`
}

function markdownCell(value) {
	return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ')
}

function htmlEscape(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;')
}

function compareResults(baseline, candidate) {
	if (baseline.mode !== candidate.mode)
		throw new Error(`Benchmark modes differ: ${baseline.mode} vs ${candidate.mode}`)
	const candidateByScenario = new Map(candidate.results.map(result => [result.scenario, result]))
	const rows = baseline.results.map((base) => {
		const head = candidateByScenario.get(base.scenario)
		if (!head)
			throw new Error(`Candidate is missing scenario ${base.scenario}`)
		if (head.category !== base.category)
			throw new Error(`Category mismatch for ${base.scenario}`)
		const ratio = head.medianOpsPerSecond / base.medianOpsPerSecond
		const delta = ratio - 1
		const stable = Math.max(base.relativeMarginOfError, head.relativeMarginOfError) <= stabilityThreshold
		const classification = !stable
			? 'unstable'
			: delta >= meaningfulThreshold / 100
				? 'improvement'
				: delta <= -meaningfulThreshold / 100
					? 'regression'
					: 'neutral'
		return {
			scenario: base.scenario,
			category: base.category,
			baselineOps: base.medianOpsPerSecond,
			candidateOps: head.medianOpsPerSecond,
			baselineRme: base.relativeMarginOfError,
			candidateRme: head.relativeMarginOfError,
			ratio,
			delta,
			stable,
			classification,
			baselineRunMedians: base.runMedians,
			candidateRunMedians: head.runMedians,
		}
	})

	const categories = [...new Set(rows.map(row => row.category))].map((category) => {
		const categoryRows = rows.filter(row => row.category === category)
		const stableRows = categoryRows.filter(row => row.stable)
		const ratio = geometricMean(stableRows.map(row => row.ratio))
		return {
			category,
			scenarios: categoryRows.length,
			stableScenarios: stableRows.length,
			ratio,
			delta: ratio == null ? null : ratio - 1,
		}
	})

	const severeScenarios = rows.filter(row => row.stable && row.delta * 100 <= severeScenarioRegression)
	const severeCategories = categories.filter(row => row.delta != null && row.stableScenarios >= 2 && row.delta * 100 <= severeCategoryRegression)
	const improvements = rows.filter(row => row.classification === 'improvement')
	const regressions = rows.filter(row => row.classification === 'regression')
	const unstable = rows.filter(row => row.classification === 'unstable')
	const verdict = severeScenarios.length > 0 || severeCategories.length > 0
		? 'regression'
		: regressions.length > 0 && improvements.length > 0
			? 'tradeoff-review'
			: regressions.length > 0
				? 'review'
				: improvements.length > 0
					? 'improvement'
					: 'neutral'

	return {
		schemaVersion: 2,
		mode: baseline.mode,
		runCounts: { baseline: baseline.runCount, candidate: candidate.runCount },
		commits: { baseline: baseline.commits, candidate: candidate.commits },
		thresholds: {
			stabilityRmePercent: stabilityThreshold,
			meaningfulChangePercent: meaningfulThreshold,
			severeScenarioRegressionPercent: Math.abs(severeScenarioRegression),
			severeCategoryRegressionPercent: Math.abs(severeCategoryRegression),
		},
		verdict,
		counts: {
			improvements: improvements.length,
			regressions: regressions.length,
			neutral: rows.filter(row => row.classification === 'neutral').length,
			unstable: unstable.length,
		},
		categories,
		rows,
		severeScenarios: severeScenarios.map(row => row.scenario),
		severeCategories: severeCategories.map(row => row.category),
	}
}

function renderMarkdown(result) {
	const lines = [
		'# Valchecker benchmark impact',
		'',
		`Verdict: **${result.verdict}** · Independent runs: **${result.runCounts.baseline} base / ${result.runCounts.candidate} candidate**`,
		'',
		`Meaningful change requires at least **${meaningfulThreshold}%** with cross-run RME at or below **${stabilityThreshold}%**.`,
		'',
		'## Category tradeoffs',
		'',
		'| Category | Stable scenarios | Geometric mean change |',
		'| --- | ---: | ---: |',
	]
	for (const row of result.categories)
		lines.push(`| ${markdownCell(row.category)} | ${row.stableScenarios}/${row.scenarios} | ${row.delta == null ? 'n/a' : formatDelta(row.delta)} |`)

	lines.push(
		'',
		'## Scenario changes',
		'',
		'| Scenario | Category | Baseline ops/s | Candidate ops/s | Change | Base cross-run RME | Head cross-run RME | Classification |',
		'| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |',
	)
	for (const row of [...result.rows].sort((left, right) => left.delta - right.delta))
		lines.push(`| ${markdownCell(row.scenario)} | ${row.category} | ${Math.round(row.baselineOps).toLocaleString('en-US')} | ${Math.round(row.candidateOps).toLocaleString('en-US')} | ${formatDelta(row.delta)} | ${row.baselineRme.toFixed(2)}% | ${row.candidateRme.toFixed(2)}% | ${row.classification} |`)

	lines.push(
		'',
		'## Decision rubric',
		'',
		'- Cross-run RME is calculated from independent process medians; within-process sample RME remains available in raw JSON.',
		'- Below 3% is normally noise unless reproduced across independent workflow runs.',
		'- 3–5% needs corroboration from adjacent scenarios or repeated runs.',
		'- At least 5% with cross-run RME ≤5% is a meaningful scenario-level change.',
		'- Construction or fresh-schema regressions may be accepted only when warmed gains are larger and the amortization point is documented.',
		'- Added code complexity or bundle size should normally buy at least 10% in a representative hot path or broad gains.',
		'- Correctness, API stability, coverage, and package integrity remain hard constraints.',
		'',
	)
	return `${lines.join('\n')}\n`
}

function renderHtml(result) {
	const categories = result.categories.map(row => `<tr><td>${htmlEscape(row.category)}</td><td>${row.stableScenarios}/${row.scenarios}</td><td>${row.delta == null ? 'n/a' : formatDelta(row.delta)}</td></tr>`).join('')
	const rows = [...result.rows].sort((left, right) => left.delta - right.delta).map(row => `<tr><td>${htmlEscape(row.scenario)}</td><td>${htmlEscape(row.category)}</td><td>${Math.round(row.baselineOps).toLocaleString('en-US')}</td><td>${Math.round(row.candidateOps).toLocaleString('en-US')}</td><td>${formatDelta(row.delta)}</td><td>${row.baselineRme.toFixed(2)}%</td><td>${row.candidateRme.toFixed(2)}%</td><td>${htmlEscape(row.classification)}</td></tr>`).join('')
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Benchmark impact</title><style>:root{font-family:ui-sans-serif,system-ui,sans-serif;color:#1f2937;background:#f8fafc}body{max-width:1180px;margin:0 auto;padding:32px 20px 64px}table{border-collapse:collapse;width:100%;background:#fff;margin-bottom:28px}th,td{padding:9px 12px;border:1px solid #cbd5e1;text-align:right}th:first-child,td:first-child,th:nth-child(2),td:nth-child(2){text-align:left}th{background:#e2e8f0}li{line-height:1.5}</style></head><body><h1>Valchecker benchmark impact</h1><p>Verdict: <strong>${htmlEscape(result.verdict)}</strong> · Independent runs: ${result.runCounts.baseline} base / ${result.runCounts.candidate} candidate</p><h2>Category tradeoffs</h2><table><thead><tr><th>Category</th><th>Stable scenarios</th><th>Change</th></tr></thead><tbody>${categories}</tbody></table><h2>Scenario changes</h2><table><thead><tr><th>Scenario</th><th>Category</th><th>Baseline ops/s</th><th>Candidate ops/s</th><th>Change</th><th>Base RME</th><th>Head RME</th><th>Classification</th></tr></thead><tbody>${rows}</tbody></table></body></html>\n`
}

const options = parseArguments(process.argv.slice(2))
const baselineRaw = await Promise.all(options.baseline.map(path => readFile(path, 'utf8').then(JSON.parse)))
const candidateRaw = await Promise.all(options.candidate.map(path => readFile(path, 'utf8').then(JSON.parse)))
const result = compareResults(
	aggregateRuns(baselineRaw, 'baseline'),
	aggregateRuns(candidateRaw, 'candidate'),
)
await Promise.all([
	mkdir(dirname(options.markdown), { recursive: true }),
	mkdir(dirname(options.json), { recursive: true }),
	mkdir(dirname(options.html), { recursive: true }),
])
await Promise.all([
	writeFile(options.markdown, renderMarkdown(result)),
	writeFile(options.json, `${JSON.stringify(result, null, 2)}\n`),
	writeFile(options.html, renderHtml(result)),
])
console.error(`[benchmark] verdict ${result.verdict}`)
if (options.failOnRegression && result.verdict === 'regression')
	process.exitCode = 1
