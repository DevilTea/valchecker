import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { supportedSchemaVersion } from './comparability.mjs'
import { perspectiveLibraries, reportPerspectives } from './perspectives.mjs'
import { isSeparated, separationThresholdPercent } from './separation.mjs'

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
	if (!raw || typeof raw !== 'object' || raw.schemaVersion !== supportedSchemaVersion)
		throw new TypeError('Invalid benchmark result')
	if (!Array.isArray(raw.scenarioCatalog) || raw.scenarioCatalog.length === 0)
		throw new TypeError('Benchmark result has no scenario catalog')
	if (!Array.isArray(raw.libraries) || raw.libraries.length === 0)
		throw new TypeError('Benchmark result has no libraries')
	// The concise view aggregates across scenarios, which is exactly the reading a
	// sharded run invalidates a second way, so it has to know how the run was
	// measured. `report` validates the record in full; this only needs it present.
	if (typeof raw.isolation !== 'string' || !Array.isArray(raw.shards) || raw.shards.length === 0)
		throw new TypeError('Benchmark result does not record its isolation and sharding')
	// Every row must be one of the catalog's scenarios, and each scenario at most once
	// per library. `report` has always refused both; this file did not, and it is run
	// standalone — the workflow calls `summary` on a raw result directly. A row naming a
	// scenario the catalog does not contain is silently dropped by the lookups below, so
	// it would shrink a group count with no sign of it, and a duplicated row would be
	// ranked twice inside its scenario and counted twice in `totalMeasurements`.
	const catalogIds = new Set(raw.scenarioCatalog.map(scenario => scenario.id))
	for (const library of raw.libraries) {
		if (!Array.isArray(library.results))
			throw new TypeError(`${library.adapter}.results must be an array`)
		const seen = new Set()
		for (const result of library.results) {
			if (!catalogIds.has(result.scenario))
				throw new Error(`${library.adapter} reports the scenario ${result.scenario}, which is not in the run's catalog`)
			if (seen.has(result.scenario))
				throw new Error(`${library.adapter} reports the scenario ${result.scenario} more than once`)
			seen.add(result.scenario)
		}
	}
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
	return String(value)
		.replaceAll('|', '\\|')
		.replaceAll('\n', ' ')
}

function htmlEscape(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll('\'', '&#39;')
}

function scenarioRows(libraries, scenario) {
	return libraries.flatMap((library) => {
		const result = library.results.find(item => item.scenario === scenario.id)
		return result == null
			? []
			: [{ adapter: library.adapter, name: library.name, version: library.version, ...result }]
	})
		.sort((left, right) => right.medianOpsPerSecond - left.medianOpsPerSecond)
}

function buildSummary(raw, libraries) {
	const groupMap = new Map()
	const stableHighlights = []
	let unstableMeasurements = 0
	let skippedMeasurements = 0

	for (const scenario of raw.scenarioCatalog) {
		const rows = scenarioRows(libraries, scenario)
		if (rows.length === 0)
			continue
		const fastest = rows[0]
		const valchecker = rows.find(row => row.adapter === 'valchecker')
		const stable = rows.length >= 2 && rows.every(row => row.relativeMarginOfError <= 5)
		unstableMeasurements += rows.filter(row => row.relativeMarginOfError > 5).length
		skippedMeasurements += libraries.length - rows.length

		let groupData = groupMap.get(scenario.group)
		if (!groupData) {
			groupData = { scenarios: 0, comparableScenarios: 0, valcheckerWins: 0, valcheckerClearWins: 0, ratios: [], stableScenarios: 0 }
			groupMap.set(scenario.group, groupData)
		}
		groupData.scenarios++
		if (rows.length >= 2)
			groupData.comparableScenarios++
		if (valchecker && stable) {
			const ratio = valchecker.medianOpsPerSecond / fastest.medianOpsPerSecond
			groupData.ratios.push(ratio)
			groupData.stableScenarios++
			if (fastest.adapter === 'valchecker') {
				groupData.valcheckerWins++
				// A win over a runner-up the run cannot separate Valchecker from is a
				// win the next run may hand to the other library, so it is counted
				// apart from the ones that would survive a rerun.
				if (isSeparated(fastest.medianOpsPerSecond, rows[1].medianOpsPerSecond))
					groupData.valcheckerClearWins++
			}
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
		weakest: sortedHighlights.slice(-3)
			.reverse(),
		unstableMeasurements,
		skippedMeasurements,
		totalMeasurements: libraries.reduce((sum, library) => sum + library.results.length, 0),
		libraryNames: libraries.map(library => library.name)
			.sort(),
	}
}

/**
 * How the run was measured, stated before the data-quality bullets, because both
 * facts decide what the group aggregates above are allowed to mean. The group
 * snapshot pools scenarios, so a sharded run pools machines and every geometric
 * mean in this file spans them.
 */
function isolationBullets(raw) {
	const shardCount = raw.shards[0].count
	return [
		raw.isolation === 'cell'
			? '- Each (adapter, scenario) cell was measured in its own process, so no cell\'s number depends on which scenarios ran before it. A number from an `adapter`-isolated run is not comparable with one from this run.'
			: '- One process measured every scenario of an adapter, so each cell\'s number depends on its position within that process — by up to 3.1× on an identical schema. Read a cell only against another cell from the same position in the same scenario selection, and prefer a `cell`-isolated run.',
		...(shardCount === 1
			? []
			: [`- The scenarios were split across ${shardCount} machines. Every adapter of one scenario was measured on one machine, so the within-scenario rankings above are sound; the group columns pool scenarios and therefore pool machines, so read them as indicative rather than as measured aggregates. The detailed report names each scenario's shard and runner.`]),
	]
}

function renderMarkdown(raw, sections) {
	const lines = [
		'# Benchmark summary',
		'',
		`Profile: **${raw.mode}** · Node: **${raw.environment.node}** · CPU: **${raw.environment.cpu}**`,
		'',
		'> This concise view separates construction, cold execution, warmed success, library-default failures, first-issue failures, and all-issues failures. Do not combine them into one overall winner.',
	]

	const split = sections.length > 1
	const collapseWarning = sections[0].perspective.warning
	if (collapseWarning != null)
		lines.push('', `> ${collapseWarning}`)
	for (const { perspective, summary } of sections) {
		const heading = split ? '###' : '##'
		if (split)
			lines.push('', `## ${perspective.title}`, '', `Libraries: ${summary.libraryNames.join(', ')}.`, '', perspective.note)

		lines.push('', `${heading} Benchmark group snapshot`, '', '| Group | Scenarios | Comparable | Stable | Stable Valchecker wins | Clear wins | Valchecker geometric mean vs fastest |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: |')
		for (const row of summary.groupRows)
			lines.push(`| ${markdownCell(row.group)} | ${row.scenarios} | ${row.comparableScenarios} | ${row.stableScenarios} | ${row.valcheckerWins} | ${row.valcheckerClearWins} | ${row.geometricMeanVsFastest == null ? 'n/a' : percent(row.geometricMeanVsFastest)} |`)

		const renderHighlights = (title, rows) => {
			lines.push('', `${heading} ${title}`, '', '| Scenario | Group | Issue policy | Issues | Valchecker vs fastest | Fastest library |', '| --- | --- | --- | ---: | ---: | --- |')
			if (rows.length === 0)
				lines.push('| n/a | n/a | n/a | n/a | n/a | n/a |')
			for (const row of rows)
				lines.push(`| ${markdownCell(row.scenario)} | ${markdownCell(row.group)} | ${markdownCell(row.issuePolicy)} | ${row.diagnosticIssueCount ?? 'n/a'} | ${percent(row.ratio)} | ${markdownCell(row.fastest)} |`)
		}
		renderHighlights('Strongest stable Valchecker scenarios', summary.strongest)
		renderHighlights('Largest stable Valchecker gaps', summary.weakest)
	}

	// Reliability describes the run's data quality and deliberate omissions, not a
	// ranking, so it is always computed across every measured library rather than
	// inherited from whichever section happens to render last.
	const summary = buildSummary(raw, raw.libraries)
	lines.push(
		'',
		'## Reliability and comparability',
		'',
		...isolationBullets(raw),
		`- Across every measured library, ${summary.unstableMeasurements} of ${summary.totalMeasurements} measured rows have RME above 5% and should be rerun before interpretation.`,
		`- Across every measured library, ${summary.skippedMeasurements} adapter/scenario combinations were intentionally omitted because the adapter exposes no equivalent diagnostic policy or lacks the schema kind entirely.`,
		`- A "clear win" is one where Valchecker leads the runner-up by more than ${separationThresholdPercent}%. The plain win count includes leads too small to reproduce: across four full runs, most orderings that changed between runs were closer than that. Quote the clear count when the claim is that Valchecker is faster.`,
		'- Library-default failures describe actual defaults but may perform different amounts of diagnostic work.',
		'- Explicit first/all scenarios verify issue counts before timing and are the correct place to compare diagnostic policy costs.',
		'- Compatible-subset scenarios compare only behavior common to every participating library: intersection avoids merge-conflict and asynchronous semantics, string formats and template literals differ in accepted sets, `record`/`tuple` differ in uniqueness and rest-region work, and Zod\'s date coercion performs no input type check.',
		'- Generated-code validators such as Zod 4 JIT can be slow during schema creation or first execution but exceptionally fast after warming.',
		'- Use the full Markdown/HTML report and raw JSON artifact for scenario-level evidence and omission reasons.',
		'',
	)
	return `${lines.join('\n')}\n`
}

function renderHtml(raw, sections) {
	const split = sections.length > 1
	const highlightTable = rows => rows.map(row => `<tr><td>${htmlEscape(row.scenario)}</td><td>${htmlEscape(row.group)}</td><td>${htmlEscape(row.issuePolicy)}</td><td>${row.diagnosticIssueCount ?? 'n/a'}</td><td>${percent(row.ratio)}</td><td>${htmlEscape(row.fastest)}</td></tr>`)
		.join('') || '<tr><td colspan="6">n/a</td></tr>'
	const collapseWarning = sections[0].perspective.warning
	const body = sections.map(({ perspective, summary }) => {
		const groupRows = summary.groupRows.map(row => `<tr><td>${htmlEscape(row.group)}</td><td>${row.scenarios}</td><td>${row.comparableScenarios}</td><td>${row.stableScenarios}</td><td>${row.valcheckerWins}</td><td>${row.valcheckerClearWins}</td><td>${row.geometricMeanVsFastest == null ? 'n/a' : percent(row.geometricMeanVsFastest)}</td></tr>`)
			.join('')
		const header = split
			? `<h2>${htmlEscape(perspective.title)}</h2><p>Libraries: ${htmlEscape(summary.libraryNames.join(', '))}.</p><p class="notice">${htmlEscape(perspective.note)}</p>`
			: ''
		const level = split ? 'h3' : 'h2'
		return `<section>${header}<${level}>Benchmark group snapshot</${level}><table><thead><tr><th>Group</th><th>Scenarios</th><th>Comparable</th><th>Stable</th><th>Valchecker wins</th><th>Clear wins</th><th>Valchecker vs fastest</th></tr></thead><tbody>${groupRows}</tbody></table><${level}>Strongest stable Valchecker scenarios</${level}><table><thead><tr><th>Scenario</th><th>Group</th><th>Issue policy</th><th>Issues</th><th>vs fastest</th><th>Fastest</th></tr></thead><tbody>${highlightTable(summary.strongest)}</tbody></table><${level}>Largest stable Valchecker gaps</${level}><table><thead><tr><th>Scenario</th><th>Group</th><th>Issue policy</th><th>Issues</th><th>vs fastest</th><th>Fastest</th></tr></thead><tbody>${highlightTable(summary.weakest)}</tbody></table></section>`
	})
		.join('')
	const summary = buildSummary(raw, raw.libraries)
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Benchmark summary</title><style>:root{font-family:ui-sans-serif,system-ui,sans-serif;color:#1f2937;background:#f8fafc}body{max-width:1040px;margin:0 auto;padding:32px 20px 64px}table{border-collapse:collapse;width:100%;background:#fff;margin-bottom:28px}th,td{padding:9px 12px;border:1px solid #cbd5e1;text-align:left}th{background:#e2e8f0}.notice{padding:12px 16px;border-left:4px solid #64748b;background:#e2e8f0}li{line-height:1.5}</style></head><body><h1>Benchmark summary</h1><p>Profile: <strong>${htmlEscape(raw.mode)}</strong> · Node: <strong>${htmlEscape(raw.environment.node)}</strong> · CPU: <strong>${htmlEscape(raw.environment.cpu)}</strong></p><p class="notice">Construction, cold execution, warmed success, and each failure-policy group are separate costs.</p>${collapseWarning == null ? '' : `<p class="notice">${htmlEscape(collapseWarning)}</p>`}${body}<h2>Reliability and comparability</h2><ul>${isolationBullets(raw)
		.map(bullet => `<li>${htmlEscape(bullet.replace(/^- /, '')
			.replaceAll('`', ''))}</li>`)
		.join('')}<li>Across every measured library, ${summary.unstableMeasurements} of ${summary.totalMeasurements} measured rows have RME above 5%.</li><li>Across every measured library, ${summary.skippedMeasurements} adapter/scenario combinations were intentionally omitted.</li><li>A clear win is a lead over the runner-up of more than ${separationThresholdPercent}%; smaller leads are not reproducible between runs.</li><li>Library defaults may perform different diagnostic work.</li><li>Explicit first/all scenarios verify issue counts before timing.</li><li>Compatible-subset scenarios test only behavior common to every participating library.</li><li>Use the full report and raw JSON for detailed conclusions.</li></ul></body></html>\n`
}

const options = parseArguments(process.argv.slice(2))
// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM benchmark entry script executed to completion at load
const raw = assertResult(JSON.parse(await readFile(options.input, 'utf8')))
const sections = reportPerspectives(raw)
	.map(perspective => ({ perspective, summary: buildSummary(raw, perspectiveLibraries(raw, perspective)) }))
// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM benchmark entry script executed to completion at load
await Promise.all([
	mkdir(dirname(options.markdown), { recursive: true }),
	mkdir(dirname(options.html), { recursive: true }),
])
// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM benchmark entry script executed to completion at load
await Promise.all([
	writeFile(options.markdown, renderMarkdown(raw, sections)),
	writeFile(options.html, renderHtml(raw, sections)),
])
console.error(`[benchmark] wrote ${options.markdown}`)
console.error(`[benchmark] wrote ${options.html}`)
