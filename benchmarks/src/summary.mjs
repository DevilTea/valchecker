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
	if (!raw || typeof raw !== 'object' || raw.schemaVersion !== 2)
		throw new TypeError('Invalid benchmark result')
	if (!Array.isArray(raw.scenarioCatalog) || raw.scenarioCatalog.length === 0)
		throw new TypeError('Benchmark result has no scenario catalog')
	if (!Array.isArray(raw.libraries) || raw.libraries.length === 0)
		throw new TypeError('Benchmark result has no libraries')
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
	return raw.libraries.flatMap((library) => {
		const result = library.results.find(item => item.scenario === scenario.id)
		return result == null
			? []
			: [{ adapter: library.adapter, name: library.name, version: library.version, ...result }]
	}).sort((left, right) => right.medianOpsPerSecond - left.medianOpsPerSecond)
}

function buildSummary(raw) {
	const groupMap = new Map()
	const stableHighlights = []
	let unstableMeasurements = 0
	let skippedMeasurements = 0

	for (const scenario of raw.scenarioCatalog) {
		const rows = scenarioRows(raw, scenario)
		if (rows.length === 0)
			continue
		const fastest = rows[0]
		const valchecker = rows.find(row => row.adapter === 'valchecker')
		const stable = rows.length >= 2 && rows.every(row => row.relativeMarginOfError <= 5)
		unstableMeasurements += rows.filter(row => row.relativeMarginOfError > 5).length
		skippedMeasurements += raw.libraries.length - rows.length

		let groupData = groupMap.get(scenario.group)
		if (!groupData) {
			groupData = { scenarios: 0, comparableScenarios: 0, valcheckerWins: 0, ratios: [], stableScenarios: 0 }
			groupMap.set(scenario.group, groupData)
		}
		groupData.scenarios++
		if (rows.length >= 2)
			groupData.comparableScenarios++
		if (valchecker && stable) {
			const ratio = valchecker.medianOpsPerSecond / fastest.medianOpsPerSecond
			groupData.ratios.push(ratio)
			groupData.stableScenarios++
			if (fastest.adapter === 'valchecker')
				groupData.valcheckerWins++
			stableHighlights.push({
				scenario: scenario.id,
				group: scenario.group,
				issuePolicy: scenario.issuePolicy,
				diagnosticIssueCount: scenario.diagnosticIssueCount,
				ratio,
				fastest: fastest.name,
			})
		}
	}

	const groupRows = [...groupMap.entries()].map(([group, data]) => ({
		group,
		...data,
		geometricMeanVsFastest: geometricMean(data.ratios),
	}))
	const sortedHighlights = [...stableHighlights].sort((left, right) => right.ratio - left.ratio)
	return {
		groupRows,
		strongest: sortedHighlights.slice(0, 3),
		weakest: sortedHighlights.slice(-3).reverse(),
		unstableMeasurements,
		skippedMeasurements,
		totalMeasurements: raw.libraries.reduce((sum, library) => sum + library.results.length, 0),
	}
}

function renderMarkdown(raw, summary) {
	const lines = [
		'# Benchmark summary',
		'',
		`Profile: **${raw.mode}** · Node: **${raw.environment.node}** · CPU: **${raw.environment.cpu}**`,
		'',
		'> This concise view separates construction, cold execution, warmed success, library-default failures, first-issue failures, and all-issues failures. Do not combine them into one overall winner.',
		'',
		'## Benchmark group snapshot',
		'',
		'| Group | Scenarios | Comparable | Stable | Stable Valchecker wins | Valchecker geometric mean vs fastest |',
		'| --- | ---: | ---: | ---: | ---: | ---: |',
	]
	for (const row of summary.groupRows) {
		lines.push(`| ${markdownCell(row.group)} | ${row.scenarios} | ${row.comparableScenarios} | ${row.stableScenarios} | ${row.valcheckerWins} | ${row.geometricMeanVsFastest == null ? 'n/a' : percent(row.geometricMeanVsFastest)} |`)
	}

	const renderHighlights = (title, rows) => {
		lines.push('', `## ${title}`, '', '| Scenario | Group | Issue policy | Issues | Valchecker vs fastest | Fastest library |', '| --- | --- | --- | ---: | ---: | --- |')
		if (rows.length === 0)
			lines.push('| n/a | n/a | n/a | n/a | n/a | n/a |')
		for (const row of rows)
			lines.push(`| ${markdownCell(row.scenario)} | ${markdownCell(row.group)} | ${markdownCell(row.issuePolicy)} | ${row.diagnosticIssueCount ?? 'n/a'} | ${percent(row.ratio)} | ${markdownCell(row.fastest)} |`)
	}
	renderHighlights('Strongest stable Valchecker scenarios', summary.strongest)
	renderHighlights('Largest stable Valchecker gaps', summary.weakest)

	lines.push(
		'',
		'## Reliability and comparability',
		'',
		`- ${summary.unstableMeasurements} of ${summary.totalMeasurements} measured rows have RME above 5% and should be rerun before interpretation.`,
		`- ${summary.skippedMeasurements} adapter/scenario combinations were intentionally omitted because the adapter does not expose an equivalent benchmark policy.`,
		'- Library-default failures describe actual defaults but may perform different amounts of diagnostic work.',
		'- Explicit first/all scenarios verify issue counts before timing and are the correct place to compare diagnostic policy costs.',
		'- Compatible-subset intersection scenarios avoid merge-conflict and asynchronous semantics that differ across libraries.',
		'- Generated-code validators such as Zod 4 JIT can be slow during schema creation or first execution but exceptionally fast after warming.',
		'- Use the full Markdown/HTML report and raw JSON artifact for scenario-level evidence and omission reasons.',
		'',
	)
	return `${lines.join('\n')}\n`
}

function renderHtml(raw, summary) {
	const groupRows = summary.groupRows.map(row => `<tr><td>${htmlEscape(row.group)}</td><td>${row.scenarios}</td><td>${row.comparableScenarios}</td><td>${row.stableScenarios}</td><td>${row.valcheckerWins}</td><td>${row.geometricMeanVsFastest == null ? 'n/a' : percent(row.geometricMeanVsFastest)}</td></tr>`).join('')
	const highlightTable = rows => rows.map(row => `<tr><td>${htmlEscape(row.scenario)}</td><td>${htmlEscape(row.group)}</td><td>${htmlEscape(row.issuePolicy)}</td><td>${row.diagnosticIssueCount ?? 'n/a'}</td><td>${percent(row.ratio)}</td><td>${htmlEscape(row.fastest)}</td></tr>`).join('') || '<tr><td colspan="6">n/a</td></tr>'
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Benchmark summary</title><style>:root{font-family:ui-sans-serif,system-ui,sans-serif;color:#1f2937;background:#f8fafc}body{max-width:1040px;margin:0 auto;padding:32px 20px 64px}table{border-collapse:collapse;width:100%;background:#fff;margin-bottom:28px}th,td{padding:9px 12px;border:1px solid #cbd5e1;text-align:left}th{background:#e2e8f0}.notice{padding:12px 16px;border-left:4px solid #64748b;background:#e2e8f0}li{line-height:1.5}</style></head><body><h1>Benchmark summary</h1><p>Profile: <strong>${htmlEscape(raw.mode)}</strong> · Node: <strong>${htmlEscape(raw.environment.node)}</strong> · CPU: <strong>${htmlEscape(raw.environment.cpu)}</strong></p><p class="notice">Construction, cold execution, warmed success, and each failure-policy group are separate costs.</p><h2>Benchmark group snapshot</h2><table><thead><tr><th>Group</th><th>Scenarios</th><th>Comparable</th><th>Stable</th><th>Valchecker wins</th><th>Valchecker vs fastest</th></tr></thead><tbody>${groupRows}</tbody></table><h2>Strongest stable Valchecker scenarios</h2><table><thead><tr><th>Scenario</th><th>Group</th><th>Issue policy</th><th>Issues</th><th>vs fastest</th><th>Fastest</th></tr></thead><tbody>${highlightTable(summary.strongest)}</tbody></table><h2>Largest stable Valchecker gaps</h2><table><thead><tr><th>Scenario</th><th>Group</th><th>Issue policy</th><th>Issues</th><th>vs fastest</th><th>Fastest</th></tr></thead><tbody>${highlightTable(summary.weakest)}</tbody></table><h2>Reliability and comparability</h2><ul><li>${summary.unstableMeasurements} of ${summary.totalMeasurements} measured rows have RME above 5%.</li><li>${summary.skippedMeasurements} adapter/scenario combinations were intentionally omitted.</li><li>Library defaults may perform different diagnostic work.</li><li>Explicit first/all scenarios verify issue counts before timing.</li><li>Intersection scenarios test only a compatible synchronous subset.</li><li>Use the full report and raw JSON for detailed conclusions.</li></ul></body></html>\n`
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
