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
		baseline: null,
		candidate: null,
		markdown: resolve(benchmarkRoot, 'results/impact.md'),
		json: resolve(benchmarkRoot, 'results/impact.json'),
		html: resolve(benchmarkRoot, 'results/impact.html'),
		failOnRegression: false,
	}
	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index]
		const value = argv[index + 1]
		if (argument === '--baseline' && value) {
			options.baseline = resolve(benchmarkRoot, value)
			index++
		}
		else if (argument === '--candidate' && value) {
			options.candidate = resolve(benchmarkRoot, value)
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
	if (!options.baseline || !options.candidate)
		throw new Error('--baseline and --candidate are required')
	return options
}

function getValchecker(raw, label) {
	if (!raw || typeof raw !== 'object' || !Array.isArray(raw.libraries))
		throw new TypeError(`${label} benchmark result is invalid`)
	const library = raw.libraries.find(item => item.adapter === 'valchecker')
	if (!library)
		throw new Error(`${label} result does not contain valchecker`)
	return library
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

function compareResults(baselineRaw, candidateRaw) {
	if (baselineRaw.mode !== candidateRaw.mode)
		throw new Error(`Benchmark modes differ: ${baselineRaw.mode} vs ${candidateRaw.mode}`)
	const baseline = getValchecker(baselineRaw, 'baseline')
	const candidate = getValchecker(candidateRaw, 'candidate')
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
		}
	})
	if (candidateByScenario.size !== rows.length)
		throw new Error('Candidate contains scenarios absent from the baseline')

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
		schemaVersion: 1,
		mode: baselineRaw.mode,
		thresholds: {
			stabilityRmePercent: stabilityThreshold,
			meaningfulChangePercent: meaningfulThreshold,
			severeScenarioRegressionPercent: Math.abs(severeScenarioRegression),
			severeCategoryRegressionPercent: Math.abs(severeCategoryRegression),
		},
		baseline: { commit: baselineRaw.environment?.commit ?? null, seed: baselineRaw.seed },
		candidate: { commit: candidateRaw.environment?.commit ?? null, seed: candidateRaw.seed },
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
		`Verdict: **${result.verdict}**`,
		'',
		`Meaningful change requires at least **${meaningfulThreshold}%** with baseline and candidate RME at or below **${stabilityThreshold}%**.`,
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
		'| Scenario | Category | Baseline ops/s | Candidate ops/s | Change | Base RME | Head RME | Classification |',
		'| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |',
	)
	const sorted = [...result.rows].sort((left, right) => left.delta - right.delta)
	for (const row of sorted)
		lines.push(`| ${markdownCell(row.scenario)} | ${row.category} | ${Math.round(row.baselineOps).toLocaleString('en-US')} | ${Math.round(row.candidateOps).toLocaleString('en-US')} | ${formatDelta(row.delta)} | ${row.baselineRme.toFixed(2)}% | ${row.candidateRme.toFixed(2)}% | ${row.classification} |`)

	lines.push(
		'',
		'## Decision rubric',
		'',
		'- Below 3% is normally noise unless reproduced across independent runs.',
		'- 3–5% needs corroboration from adjacent scenarios or repeated runs.',
		'- At least 5% with RME ≤5% is a meaningful scenario-level change.',
		'- Construction or fresh-schema regressions may be acceptable only when warmed gains are larger and the amortization point is documented.',
		'- Added code complexity or bundle size should normally buy at least 10% in a representative hot path or broad gains across multiple scenarios.',
		'- Performance never overrides semantic correctness, API stability, coverage, or package-size constraints.',
		'- A mixed result is a reviewer decision, not an automatic win: document the target workload and why the tradeoff is valuable.',
		'',
	)
	return `${lines.join('\n')}\n`
}

function renderHtml(result) {
	const categories = result.categories.map(row => `<tr><td>${htmlEscape(row.category)}</td><td>${row.stableScenarios}/${row.scenarios}</td><td>${row.delta == null ? 'n/a' : formatDelta(row.delta)}</td></tr>`).join('')
	const rows = [...result.rows].sort((left, right) => left.delta - right.delta).map(row => `<tr><td>${htmlEscape(row.scenario)}</td><td>${htmlEscape(row.category)}</td><td>${Math.round(row.baselineOps).toLocaleString('en-US')}</td><td>${Math.round(row.candidateOps).toLocaleString('en-US')}</td><td>${formatDelta(row.delta)}</td><td>${row.baselineRme.toFixed(2)}%</td><td>${row.candidateRme.toFixed(2)}%</td><td>${htmlEscape(row.classification)}</td></tr>`).join('')
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Benchmark impact</title><style>:root{font-family:ui-sans-serif,system-ui,sans-serif;color:#1f2937;background:#f8fafc}body{max-width:1180px;margin:0 auto;padding:32px 20px 64px}table{border-collapse:collapse;width:100%;background:#fff;margin-bottom:28px}th,td{padding:9px 12px;border:1px solid #cbd5e1;text-align:right}th:first-child,td:first-child,th:nth-child(2),td:nth-child(2){text-align:left}th{background:#e2e8f0}li{line-height:1.5}</style></head><body><h1>Valchecker benchmark impact</h1><p>Verdict: <strong>${htmlEscape(result.verdict)}</strong></p><p>Meaningful change requires at least ${meaningfulThreshold}% with RME at or below ${stabilityThreshold}%.</p><h2>Category tradeoffs</h2><table><thead><tr><th>Category</th><th>Stable scenarios</th><th>Geometric mean change</th></tr></thead><tbody>${categories}</tbody></table><h2>Scenario changes</h2><table><thead><tr><th>Scenario</th><th>Category</th><th>Baseline ops/s</th><th>Candidate ops/s</th><th>Change</th><th>Base RME</th><th>Head RME</th><th>Classification</th></tr></thead><tbody>${rows}</tbody></table><h2>Decision rubric</h2><ul><li>Below 3% is normally noise; 3–5% needs corroboration.</li><li>At least 5% with RME ≤5% is meaningful.</li><li>Construction regressions need documented warm-path amortization.</li><li>Complexity or size growth should buy at least 10% in a representative path or broad gains.</li><li>Correctness, API stability, coverage, and package size remain hard constraints.</li></ul></body></html>\n`
}

const options = parseArguments(process.argv.slice(2))
const [baselineRaw, candidateRaw] = await Promise.all([
	readFile(options.baseline, 'utf8').then(JSON.parse),
	readFile(options.candidate, 'utf8').then(JSON.parse),
])
const result = compareResults(baselineRaw, candidateRaw)
const markdown = renderMarkdown(result)
const html = renderHtml(result)
await Promise.all([
	mkdir(dirname(options.markdown), { recursive: true }),
	mkdir(dirname(options.json), { recursive: true }),
	mkdir(dirname(options.html), { recursive: true }),
])
await Promise.all([
	writeFile(options.markdown, markdown),
	writeFile(options.json, `${JSON.stringify(result, null, 2)}\n`),
	writeFile(options.html, html),
])
console.error(`[benchmark] verdict ${result.verdict}`)
if (options.failOnRegression && result.verdict === 'regression')
	process.exitCode = 1
