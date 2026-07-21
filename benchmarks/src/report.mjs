import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const benchmarkRoot = fileURLToPath(new URL('..', import.meta.url))
const categories = new Set(['construction', 'cold', 'warm'])
const modes = new Set(['smoke', 'standard', 'full'])
const resultKinds = new Set(['success', 'failure'])
const issuePolicies = new Set(['not-applicable', 'library-default', 'first', 'all'])
const comparisonScopes = new Set(['equivalent', 'library-defaults', 'compatible-subset'])

function parseArguments(argv) {
	const options = {
		input: resolve(benchmarkRoot, 'results/raw.json'),
		markdown: resolve(benchmarkRoot, 'results/report.md'),
		html: resolve(benchmarkRoot, 'results/report.html'),
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

function assertNonEmptyString(value, path) {
	if (typeof value !== 'string' || value.length === 0)
		throw new Error(`${path} must be a non-empty string`)
}

function assertOptionalString(value, path) {
	if (value !== null && value !== undefined)
		assertNonEmptyString(value, path)
}

function assertFinitePositive(value, path) {
	if (!Number.isFinite(value) || value <= 0)
		throw new Error(`${path} must be a finite positive number`)
}

function validateMeasurement(result, path) {
	assertFinitePositive(result.medianOpsPerSecond, `${path}.medianOpsPerSecond`)
	assertFinitePositive(result.medianNanosecondsPerOperation, `${path}.medianNanosecondsPerOperation`)
	assertFinitePositive(result.meanOpsPerSecond, `${path}.meanOpsPerSecond`)
	if (!Number.isFinite(result.relativeMarginOfError) || result.relativeMarginOfError < 0)
		throw new Error(`${path}.relativeMarginOfError must be a finite non-negative number`)
	if (!Array.isArray(result.samples) || result.samples.length === 0)
		throw new Error(`${path}.samples must be a non-empty array`)

	for (const [sampleIndex, sample] of result.samples.entries()) {
		const samplePath = `${path}.samples[${sampleIndex}]`
		if (!sample || typeof sample !== 'object')
			throw new TypeError(`${samplePath} must be an object`)
		assertFinitePositive(sample.iterations, `${samplePath}.iterations`)
		assertFinitePositive(sample.elapsedNs, `${samplePath}.elapsedNs`)
		assertFinitePositive(sample.opsPerSecond, `${samplePath}.opsPerSecond`)
		assertFinitePositive(sample.nanosecondsPerOperation, `${samplePath}.nanosecondsPerOperation`)
	}
}

function validateResult(raw) {
	if (!raw || typeof raw !== 'object')
		throw new TypeError('Benchmark result must be an object')
	if (raw.schemaVersion !== 2)
		throw new Error(`Unsupported benchmark schema version: ${raw.schemaVersion}`)
	if (!modes.has(raw.mode))
		throw new Error(`Unknown benchmark mode: ${raw.mode}`)

	assertNonEmptyString(raw.seed, 'seed')
	assertNonEmptyString(raw.startedAt, 'startedAt')
	assertNonEmptyString(raw.completedAt, 'completedAt')
	if (!raw.environment || typeof raw.environment !== 'object')
		throw new TypeError('environment must be an object')
	for (const field of ['node', 'platform', 'arch', 'cpu'])
		assertNonEmptyString(raw.environment[field], `environment.${field}`)
	for (const field of ['commit', 'runnerName', 'runnerImageOS', 'runnerImageVersion'])
		assertOptionalString(raw.environment[field], `environment.${field}`)
	assertFinitePositive(raw.environment.logicalCpuCount, 'environment.logicalCpuCount')
	assertFinitePositive(raw.environment.totalMemoryBytes, 'environment.totalMemoryBytes')

	if (!Array.isArray(raw.scenarioCatalog) || raw.scenarioCatalog.length === 0)
		throw new Error('scenarioCatalog must contain at least one scenario')
	const catalog = new Map()
	for (const [index, scenario] of raw.scenarioCatalog.entries()) {
		const path = `scenarioCatalog[${index}]`
		if (!scenario || typeof scenario !== 'object')
			throw new TypeError(`${path} must be an object`)
		for (const field of ['id', 'tier', 'group'])
			assertNonEmptyString(scenario[field], `${path}.${field}`)
		if (catalog.has(scenario.id))
			throw new Error(`Duplicate scenario catalog entry: ${scenario.id}`)
		if (!categories.has(scenario.category))
			throw new Error(`${path}.category is invalid`)
		if (!resultKinds.has(scenario.resultKind))
			throw new Error(`${path}.resultKind is invalid`)
		if (!issuePolicies.has(scenario.issuePolicy))
			throw new Error(`${path}.issuePolicy is invalid`)
		if (!comparisonScopes.has(scenario.comparisonScope))
			throw new Error(`${path}.comparisonScope is invalid`)
		catalog.set(scenario.id, scenario)
	}

	if (!Array.isArray(raw.libraries) || raw.libraries.length === 0)
		throw new Error('Benchmark result must contain at least one library')
	if (!Array.isArray(raw.order) || raw.order.length !== raw.libraries.length)
		throw new Error('Execution order must contain every library exactly once')

	const adapterNames = new Set()
	for (const [libraryIndex, library] of raw.libraries.entries()) {
		const libraryPath = `libraries[${libraryIndex}]`
		if (!library || typeof library !== 'object')
			throw new TypeError(`${libraryPath} must be an object`)
		assertNonEmptyString(library.adapter, `${libraryPath}.adapter`)
		assertNonEmptyString(library.name, `${library.adapter}.name`)
		assertNonEmptyString(library.version, `${library.adapter}.version`)
		if (adapterNames.has(library.adapter))
			throw new Error(`Duplicate adapter result: ${library.adapter}`)
		adapterNames.add(library.adapter)
		if (!Array.isArray(library.results))
			throw new Error(`${library.adapter}.results must be an array`)
		if (!Array.isArray(library.skippedScenarios))
			throw new Error(`${library.adapter}.skippedScenarios must be an array`)

		const accounted = new Set()
		for (const [resultIndex, result] of library.results.entries()) {
			const path = `${library.adapter}.results[${resultIndex}]`
			if (!result || typeof result !== 'object')
				throw new TypeError(`${path} must be an object`)
			assertNonEmptyString(result.scenario, `${path}.scenario`)
			if (accounted.has(result.scenario))
				throw new Error(`${library.adapter} contains duplicate scenario ${result.scenario}`)
			accounted.add(result.scenario)
			const expected = catalog.get(result.scenario)
			if (!expected)
				throw new Error(`${library.adapter} contains unexpected scenario ${result.scenario}`)
			for (const field of ['category', 'group', 'resultKind', 'issuePolicy', 'comparisonScope']) {
				if (result[field] !== expected[field])
					throw new Error(`${library.adapter} metadata mismatch for ${result.scenario}.${field}`)
			}
			validateMeasurement(result, path)
		}

		for (const [skipIndex, skipped] of library.skippedScenarios.entries()) {
			const path = `${library.adapter}.skippedScenarios[${skipIndex}]`
			if (!skipped || typeof skipped !== 'object')
				throw new TypeError(`${path} must be an object`)
			assertNonEmptyString(skipped.scenario, `${path}.scenario`)
			assertNonEmptyString(skipped.reason, `${path}.reason`)
			if (!catalog.has(skipped.scenario))
				throw new Error(`${library.adapter} skipped unknown scenario ${skipped.scenario}`)
			if (accounted.has(skipped.scenario))
				throw new Error(`${library.adapter} accounts for ${skipped.scenario} more than once`)
			accounted.add(skipped.scenario)
		}

		const missing = [...catalog.keys()].filter(scenario => !accounted.has(scenario))
		if (missing.length > 0)
			throw new Error(`${library.adapter} is missing scenario accounting: ${missing.join(',')}`)
	}

	if (new Set(raw.order).size !== raw.order.length || raw.order.some(adapter => !adapterNames.has(adapter)))
		throw new Error('Execution order must contain every library exactly once')

	return raw
}

function formatNumber(value, maximumFractionDigits = 0) {
	return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value)
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
	const rows = raw.libraries.flatMap((library) => {
		const result = library.results.find(item => item.scenario === scenario.id)
		return result == null
			? []
			: [{
					adapter: library.adapter,
					library: library.name,
					version: library.version,
					...result,
				}]
	}).sort((left, right) => right.medianOpsPerSecond - left.medianOpsPerSecond)

	if (rows.length === 0)
		throw new Error(`No adapter measured scenario ${scenario.id}`)
	const fastest = rows[0].medianOpsPerSecond
	const valchecker = rows.find(row => row.adapter === 'valchecker')?.medianOpsPerSecond
	return rows.map((row, index) => ({
		...row,
		rank: index + 1,
		percentOfFastest: row.medianOpsPerSecond / fastest * 100,
		versusValchecker: valchecker ? row.medianOpsPerSecond / valchecker : null,
		unstable: row.relativeMarginOfError > 5,
	}))
}

function skippedRows(raw, scenario) {
	return raw.libraries.flatMap((library) => {
		const skipped = library.skippedScenarios.find(item => item.scenario === scenario.id)
		return skipped == null ? [] : [{ library: library.name, reason: skipped.reason }]
	})
}

function metadataRows(raw) {
	const runnerImage = [raw.environment.runnerImageOS, raw.environment.runnerImageVersion]
		.filter(Boolean)
		.join(' ')
	return [
		['Profile', raw.mode],
		['Seed', raw.seed],
		['Started', raw.startedAt],
		['Completed', raw.completedAt],
		['Node.js', raw.environment.node],
		['Platform', `${raw.environment.platform}/${raw.environment.arch}`],
		['CPU', raw.environment.cpu],
		['Logical CPUs', raw.environment.logicalCpuCount],
		['Runner', raw.environment.runnerName ?? 'local'],
		['Runner image', runnerImage || 'local'],
		['Commit', raw.environment.commit ?? 'local'],
		['Execution order', raw.order.join(' → ')],
	]
}

function renderMarkdown(raw) {
	const lines = [
		'# Valchecker cross-library benchmark report',
		'',
		'> Construction, cold execution, warmed success, and warmed failure-policy groups measure different costs and must not be combined into one overall ranking.',
		'',
		'## Run metadata',
		'',
		'| Field | Value |',
		'| --- | --- |',
		...metadataRows(raw).map(([field, value]) => `| ${markdownCell(field)} | ${markdownCell(value)} |`),
		'',
		'## Results',
		'',
	]

	for (const scenario of raw.scenarioCatalog) {
		const rows = scenarioRows(raw, scenario)
		const skipped = skippedRows(raw, scenario)
		lines.push(
			`### ${scenario.id}`,
			'',
			`Group: **${scenario.group}** · Result: **${scenario.resultKind}** · Issue policy: **${scenario.issuePolicy}** · Comparison scope: **${scenario.comparisonScope}**`,
			'',
			'| Rank | Library | Version | Median ops/s | Median ns/op | Fastest | vs Valchecker | RME |',
			'| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: |',
			...rows.map(row => `| ${[
				row.rank,
				markdownCell(row.library),
				markdownCell(row.version),
				formatNumber(row.medianOpsPerSecond),
				formatNumber(row.medianNanosecondsPerOperation, 1),
				`${row.percentOfFastest.toFixed(1)}%`,
				row.versusValchecker === null ? 'n/a' : `${row.versusValchecker.toFixed(2)}×`,
				`${row.relativeMarginOfError.toFixed(2)}%${row.unstable ? ' ⚠' : ''}`,
			].join(' | ')} |`),
			'',
		)
		if (skipped.length > 0) {
			lines.push(
				`Not ranked: ${skipped.map(item => `${markdownCell(item.library)} — ${markdownCell(item.reason)}`).join('; ')}`,
				'',
			)
		}
	}

	lines.push(
		'## Interpretation rules',
		'',
		'- Compare libraries only within the same scenario, benchmark group, and issue policy.',
		'- `library-default` failure scenarios show product defaults and are not diagnostic-work-equivalent across libraries.',
		'- `first` and `all` scenarios verify issue-count semantics before timing; unsupported adapters are omitted instead of being assigned a synthetic mode.',
		'- `compatible-subset` scenarios intentionally test only behavior that is common to every participating library.',
		'- Treat results with RME above 5% as unstable and rerun before drawing conclusions.',
		'- The raw JSON artifact remains the source of truth for every sample and skipped-adapter reason.',
		'',
	)
	return `${lines.join('\n')}\n`
}

function renderHtml(raw) {
	const metadata = metadataRows(raw)
		.map(([field, value]) => `<tr><th>${htmlEscape(field)}</th><td>${htmlEscape(value)}</td></tr>`)
		.join('')
	const sections = raw.scenarioCatalog.map((scenario) => {
		const rows = scenarioRows(raw, scenario)
		const body = rows.map(row => `<tr${row.unstable ? ' class="unstable"' : ''}><td>${row.rank}</td><td>${htmlEscape(row.library)}</td><td>${htmlEscape(row.version)}</td><td>${formatNumber(row.medianOpsPerSecond)}</td><td>${formatNumber(row.medianNanosecondsPerOperation, 1)}</td><td>${row.percentOfFastest.toFixed(1)}%</td><td>${row.versusValchecker === null ? 'n/a' : `${row.versusValchecker.toFixed(2)}×`}</td><td>${row.relativeMarginOfError.toFixed(2)}%${row.unstable ? ' ⚠' : ''}</td></tr>`).join('')
		const skipped = skippedRows(raw, scenario)
		const skippedText = skipped.length === 0
			? ''
			: `<p><strong>Not ranked:</strong> ${skipped.map(item => `${htmlEscape(item.library)} — ${htmlEscape(item.reason)}`).join('; ')}</p>`
		return `<section><h2>${htmlEscape(scenario.id)}</h2><p>Group: <strong>${htmlEscape(scenario.group)}</strong> · Result: <strong>${htmlEscape(scenario.resultKind)}</strong> · Issue policy: <strong>${htmlEscape(scenario.issuePolicy)}</strong> · Comparison scope: <strong>${htmlEscape(scenario.comparisonScope)}</strong></p><div class="table-wrap"><table><thead><tr><th>Rank</th><th>Library</th><th>Version</th><th>Median ops/s</th><th>Median ns/op</th><th>Fastest</th><th>vs Valchecker</th><th>RME</th></tr></thead><tbody>${body}</tbody></table></div>${skippedText}</section>`
	}).join('')

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Valchecker benchmark report</title>
<style>
:root{font-family:ui-sans-serif,system-ui,sans-serif;color:#1f2937;background:#f8fafc}body{max-width:1180px;margin:0 auto;padding:32px 20px 64px}h1{margin-bottom:8px}h2{margin-top:40px}p,li{line-height:1.5}.notice{padding:12px 16px;border-left:4px solid #64748b;background:#e2e8f0}.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;background:white}th,td{padding:9px 12px;border:1px solid #cbd5e1;text-align:right;white-space:nowrap}th:first-child,td:first-child,th:nth-child(2),td:nth-child(2),th:nth-child(3),td:nth-child(3){text-align:left}thead th{background:#e2e8f0}.metadata{max-width:760px}.metadata th{width:180px}.unstable{background:#fff7ed}
</style>
</head>
<body>
<h1>Valchecker cross-library benchmark report</h1>
<p class="notice">Construction, cold execution, warmed success, and warmed failure-policy groups measure different costs and must not be combined into one overall ranking.</p>
<h2>Run metadata</h2>
<table class="metadata"><tbody>${metadata}</tbody></table>
${sections}
<h2>Interpretation rules</h2>
<ul><li>Compare libraries only within the same scenario, benchmark group, and issue policy.</li><li>Library-default failures are not diagnostic-work-equivalent.</li><li>Explicit first/all scenarios verify issue counts and omit unsupported adapters.</li><li>Compatible-subset scenarios test only common behavior.</li><li>RME above 5% is unstable.</li><li>The raw JSON remains the source of truth.</li></ul>
</body>
</html>
`
}

const options = parseArguments(process.argv.slice(2))
const raw = validateResult(JSON.parse(await readFile(options.input, 'utf8')))
const markdown = renderMarkdown(raw)
const html = renderHtml(raw)
await Promise.all([
	mkdir(dirname(options.markdown), { recursive: true }),
	mkdir(dirname(options.html), { recursive: true }),
])
await Promise.all([
	writeFile(options.markdown, markdown),
	writeFile(options.html, html),
])
console.error(`[benchmark] wrote ${options.markdown}`)
console.error(`[benchmark] wrote ${options.html}`)
