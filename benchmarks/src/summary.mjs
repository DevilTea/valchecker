import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const benchmarkRoot = fileURLToPath(new URL('..', import.meta.url))

function parseArguments(argv) {
	const options = {
		input: resolve(benchmarkRoot, 'results/raw.json'),
		markdown: resolve(benchmarkRoot, 'results/summary.md'),
		html: resolve(benchmarkRoot, 'results/summary.html'),
	}
	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index]
		const value = argv[index + 1]
		if (argument === '--input' && value) {
			options.input = resolve(benchmarkRoot, value)
			index++
		}
		else if (argument === '--markdown' && value) {
			options.markdown = resolve(benchmarkRoot, value)
			index++
		}
		else if (argument === '--html' && value) {
			options.html = resolve(benchmarkRoot, value)
			index++
		}
		else {
			throw new Error(`Unknown or incomplete argument: ${argument}`)
		}
	}
	return options
}

function assertResult(raw) {
	if (!raw || typeof raw !== 'object' || !Array.isArray(raw.libraries) || raw.libraries.length === 0)
		throw new TypeError('Invalid benchmark result')
	return raw
}

function geometricMean(values) {
	return values.length === 0
		? null
		: Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length)
}

function percent(value) {
	return `${(value * 100).toFixed(1)}%`
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

function scenarioRows(raw, scenario) {
	return raw.libraries.map((library) => {
		const result = library.results.find(item => item.scenario === scenario)
		if (!result)
			throw new Error(`${library.adapter} is missing scenario ${scenario}`)
		return { adapter: library.adapter, name: library.name, version: library.version, ...result }
	}).sort((left, right) => right.medianOpsPerSecond - left.medianOpsPerSecond)
}

function buildSummary(raw) {
	const scenarios = raw.libraries[0].results.map(result => result.scenario)
	const categoryMap = new Map()
	const stableHighlights = []
	let unstableMeasurements = 0

	for (const scenario of scenarios) {
		const rows = scenarioRows(raw, scenario)
		const category = rows[0].category
		const fastest = rows[0]
		const valchecker = rows.find(row => row.adapter === 'valchecker')
		const stable = rows.every(row => row.relativeMarginOfError <= 5)
		unstableMeasurements += rows.filter(row => row.relativeMarginOfError > 5).length

		let categoryData = categoryMap.get(category)
		if (!categoryData) {
			categoryData = { scenarios: 0, valcheckerWins: 0, ratios: [], stableScenarios: 0 }
			categoryMap.set(category, categoryData)
		}
		categoryData.scenarios++
		if (valchecker && stable) {
			const ratio = valchecker.medianOpsPerSecond / fastest.medianOpsPerSecond
			categoryData.ratios.push(ratio)
			categoryData.stableScenarios++
			if (fastest.adapter === 'valchecker')
				categoryData.valcheckerWins++
			stableHighlights.push({ scenario, category, ratio, fastest: fastest.name })
		}
	}

	const categoryRows = [...categoryMap.entries()].map(([category, data]) => ({
		category,
		...data,
		geometricMeanVsFastest: geometricMean(data.ratios),
	}))
	const sortedHighlights = [...stableHighlights].sort((left, right) => right.ratio - left.ratio)
	return {
		categoryRows,
		strongest: sortedHighlights.slice(0, 3),
		weakest: sortedHighlights.slice(-3).reverse(),
		unstableMeasurements,
		totalMeasurements: raw.libraries.reduce((sum, library) => sum + library.results.length, 0),
	}
}

function renderMarkdown(raw, summary) {
	const lines = [
		'# Benchmark summary',
		'',
		`Profile: **${raw.mode}** · Node: **${raw.environment.node}** · CPU: **${raw.environment.cpu}**`,
		'',
		'> This is the concise view. Construction, fresh-schema execution, and warmed validation are separate costs; do not combine them into one overall winner.',
		'',
		'## Category snapshot',
		'',
		'| Category | Scenarios | Stable scenarios | Stable Valchecker wins | Valchecker geometric mean vs fastest |',
		'| --- | ---: | ---: | ---: | ---: |',
	]
	for (const row of summary.categoryRows)
		lines.push(`| ${markdownCell(row.category)} | ${row.scenarios} | ${row.stableScenarios} | ${row.valcheckerWins} | ${row.geometricMeanVsFastest == null ? 'n/a' : percent(row.geometricMeanVsFastest)} |`)

	const renderHighlights = (title, rows) => {
		lines.push('', `## ${title}`, '', '| Scenario | Category | Valchecker vs fastest | Fastest library |', '| --- | --- | ---: | --- |')
		if (rows.length === 0)
			lines.push('| n/a | n/a | n/a | n/a |')
		for (const row of rows)
			lines.push(`| ${markdownCell(row.scenario)} | ${row.category} | ${percent(row.ratio)} | ${markdownCell(row.fastest)} |`)
	}
	renderHighlights('Strongest stable Valchecker scenarios', summary.strongest)
	renderHighlights('Largest stable Valchecker gaps', summary.weakest)

	lines.push(
		'',
		'## Reliability',
		'',
		`- ${summary.unstableMeasurements} of ${summary.totalMeasurements} measurements have RME above 5% and should be rerun before interpretation.`,
		'- Generated-code validators such as Zod 4 JIT can be slow during schema creation or first execution but exceptionally fast after the schema is warmed.',
		'- Fixed-input warm scenarios represent steady-state throughput, not cold-start latency or whole-application performance.',
		'- Rotating-input scenarios are stronger evidence for real-world same-shape request objects.',
		'- Use the full Markdown/HTML report and raw JSON artifact for scenario-level evidence.',
		'',
	)
	return `${lines.join('\n')}\n`
}

function renderHtml(raw, summary) {
	const categoryRows = summary.categoryRows.map(row => `<tr><td>${htmlEscape(row.category)}</td><td>${row.scenarios}</td><td>${row.stableScenarios}</td><td>${row.valcheckerWins}</td><td>${row.geometricMeanVsFastest == null ? 'n/a' : percent(row.geometricMeanVsFastest)}</td></tr>`).join('')
	const highlightTable = rows => rows.map(row => `<tr><td>${htmlEscape(row.scenario)}</td><td>${htmlEscape(row.category)}</td><td>${percent(row.ratio)}</td><td>${htmlEscape(row.fastest)}</td></tr>`).join('') || '<tr><td colspan="4">n/a</td></tr>'
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Benchmark summary</title><style>:root{font-family:ui-sans-serif,system-ui,sans-serif;color:#1f2937;background:#f8fafc}body{max-width:960px;margin:0 auto;padding:32px 20px 64px}table{border-collapse:collapse;width:100%;background:#fff;margin-bottom:28px}th,td{padding:9px 12px;border:1px solid #cbd5e1;text-align:left}th{background:#e2e8f0}.notice{padding:12px 16px;border-left:4px solid #64748b;background:#e2e8f0}li{line-height:1.5}</style></head><body><h1>Benchmark summary</h1><p>Profile: <strong>${htmlEscape(raw.mode)}</strong> · Node: <strong>${htmlEscape(raw.environment.node)}</strong> · CPU: <strong>${htmlEscape(raw.environment.cpu)}</strong></p><p class="notice">Construction, fresh-schema execution, and warmed validation are separate costs; do not combine them into one overall winner.</p><h2>Category snapshot</h2><table><thead><tr><th>Category</th><th>Scenarios</th><th>Stable</th><th>Stable Valchecker wins</th><th>Valchecker vs fastest</th></tr></thead><tbody>${categoryRows}</tbody></table><h2>Strongest stable Valchecker scenarios</h2><table><thead><tr><th>Scenario</th><th>Category</th><th>vs fastest</th><th>Fastest</th></tr></thead><tbody>${highlightTable(summary.strongest)}</tbody></table><h2>Largest stable Valchecker gaps</h2><table><thead><tr><th>Scenario</th><th>Category</th><th>vs fastest</th><th>Fastest</th></tr></thead><tbody>${highlightTable(summary.weakest)}</tbody></table><h2>Reliability</h2><ul><li>${summary.unstableMeasurements} of ${summary.totalMeasurements} measurements have RME above 5%.</li><li>Zod 4 JIT can trade schema/first-run cost for exceptional warmed object throughput.</li><li>Fixed-input warm scenarios are steady-state microbenchmarks, not whole-application performance.</li><li>Rotating inputs provide stronger real-world evidence.</li><li>Use the full report and raw JSON for detailed conclusions.</li></ul></body></html>\n`
}

const options = parseArguments(process.argv.slice(2))
const raw = assertResult(JSON.parse(await readFile(options.input, 'utf8')))
const summary = buildSummary(raw)
await Promise.all([
	mkdir(dirname(options.markdown), { recursive: true }),
	mkdir(dirname(options.html), { recursive: true }),
])
await Promise.all([
	writeFile(options.markdown, renderMarkdown(raw, summary)),
	writeFile(options.html, renderHtml(raw, summary)),
])
console.error(`[benchmark] wrote ${options.markdown}`)
console.error(`[benchmark] wrote ${options.html}`)
