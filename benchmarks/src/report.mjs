import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { supportedSchemaVersion } from './comparability.mjs'
import { INTERPRETED_PERSPECTIVE, isInPerspective, reportPerspectives } from './perspectives.mjs'
import { isSeparated, separationThresholdPercent } from './separation.mjs'
import { isolations } from './sharding.mjs'

const benchmarkRoot = fileURLToPath(new URL('..', import.meta.url))
const categories = new Set(['construction', 'cold', 'warm'])
const modes = new Set(['smoke', 'standard', 'full'])
const resultKinds = new Set(['success', 'failure'])
const issuePolicies = new Set(['not-applicable', 'library-default', 'first', 'all'])
const comparisonScopes = new Set(['equivalent', 'library-defaults', 'compatible-subset'])
const executionModes = new Set(['sync', 'async'])
const entries = new Set(['native', 'standard'])

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

/**
 * How a cell was measured, and through which entry point. An artifact written
 * before asynchronous measurement existed carries neither field, and every cell in
 * one was measured synchronously through the library's native entry, so reading a
 * missing field that way is a fact about those runs rather than a lenient default.
 * A present value must be one the harness can produce.
 */
function readEnumerated(value, allowed, fallback, path) {
	if (value === undefined)
		return fallback
	if (!allowed.has(value))
		throw new Error(`${path} is invalid`)
	return value
}

function validateEnvironment(environment, path) {
	if (!environment || typeof environment !== 'object')
		throw new TypeError(`${path} must be an object`)
	for (const field of ['node', 'platform', 'arch', 'cpu'])
		assertNonEmptyString(environment[field], `${path}.${field}`)
	for (const field of ['commit', 'runnerName', 'runnerImageOS', 'runnerImageVersion'])
		assertOptionalString(environment[field], `${path}.${field}`)
	assertFinitePositive(environment.logicalCpuCount, `${path}.logicalCpuCount`)
	assertFinitePositive(environment.totalMemoryBytes, `${path}.totalMemoryBytes`)
}

/**
 * The shard record, checked strictly because it is what tells a reader which
 * machine produced which scenario. A merged run that is missing a shard, or whose
 * shards do not cover the catalog exactly, would present a partial scenario set as
 * a whole run with nothing in the rendered report to show it.
 */
function validateShards(raw, catalogIds) {
	if (!Array.isArray(raw.shards) || raw.shards.length === 0)
		throw new Error('shards must contain at least one entry')
	const count = raw.shards[0].count
	if (!Number.isInteger(count) || count < 1)
		throw new Error('shards[0].count must be a positive integer')
	if (raw.shards.length !== count)
		throw new Error(`shards contains ${raw.shards.length} of the run's ${count} shards, so the result is incomplete`)
	const seen = new Set()
	const covered = []
	for (const [index, shard] of raw.shards.entries()) {
		const path = `shards[${index}]`
		if (!shard || typeof shard !== 'object')
			throw new TypeError(`${path} must be an object`)
		if (shard.count !== count)
			throw new Error(`${path}.count must equal ${count}`)
		if (!Number.isInteger(shard.index) || shard.index < 0 || shard.index >= count)
			throw new Error(`${path}.index must be an integer in [0, ${count})`)
		if (seen.has(shard.index))
			throw new Error(`Duplicate shard index ${shard.index}`)
		seen.add(shard.index)
		assertNonEmptyString(shard.startedAt, `${path}.startedAt`)
		assertNonEmptyString(shard.completedAt, `${path}.completedAt`)
		validateEnvironment(shard.environment, `${path}.environment`)
		if (!Array.isArray(shard.scenarios) || shard.scenarios.length === 0)
			throw new Error(`${path}.scenarios must be a non-empty array`)
		covered.push(...shard.scenarios)
	}
	if (covered.length !== catalogIds.size || covered.some(scenario => !catalogIds.has(scenario)))
		throw new Error('The shards must cover every catalog scenario exactly once')
	if (new Set(covered).size !== covered.length)
		throw new Error('A scenario is claimed by more than one shard')
}

function validateResult(raw) {
	if (!raw || typeof raw !== 'object')
		throw new TypeError('Benchmark result must be an object')
	if (raw.schemaVersion !== supportedSchemaVersion)
		throw new Error(`Unsupported benchmark schema version: ${raw.schemaVersion}`)
	if (!modes.has(raw.mode))
		throw new Error(`Unknown benchmark mode: ${raw.mode}`)
	// Isolation is reported next to the numbers because it is part of what they mean:
	// a cell measured alone and a cell measured after other scenarios in the same
	// process differ by up to 3.1× on the same schema.
	if (!isolations.includes(raw.isolation))
		throw new Error(`Unknown measurement isolation: ${raw.isolation}`)

	// The profile is reported as the sampling method the numbers came from, so a
	// missing field must fail here rather than reach a reader as text. It read
	// "exactly undefined samples" while every other field in this file was checked.
	if (!raw.profile || typeof raw.profile !== 'object')
		throw new TypeError('profile must be an object')
	for (const field of ['warmupMs', 'sampleMs', 'minSamples', 'maxSamples'])
		assertFinitePositive(raw.profile[field], `profile.${field}`)
	if (raw.profile.maxSamples < raw.profile.minSamples)
		throw new Error('profile.maxSamples must not be below profile.minSamples')
	if (raw.profile.targetRelativeMarginOfError !== null)
		assertFinitePositive(raw.profile.targetRelativeMarginOfError, 'profile.targetRelativeMarginOfError')

	assertNonEmptyString(raw.seed, 'seed')
	assertNonEmptyString(raw.startedAt, 'startedAt')
	assertNonEmptyString(raw.completedAt, 'completedAt')
	validateEnvironment(raw.environment, 'environment')

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
		assertOptionalString(scenario.comparisonNote, `${path}.comparisonNote`)
		assertOptionalString(scenario.conformanceKey, `${path}.conformanceKey`)
		if (scenario.conformanceCaseCount !== undefined && (!Number.isInteger(scenario.conformanceCaseCount) || scenario.conformanceCaseCount < 0))
			throw new Error(`${path}.conformanceCaseCount must be a non-negative integer`)
		assertOptionalString(scenario.conformanceNoFailureReason, `${path}.conformanceNoFailureReason`)
		if (scenario.conformanceKey != null && (scenario.conformanceCaseCount ?? 0) === 0)
			throw new Error(`${path} names a conformance contract but records no executable cases`)
		if (scenario.diagnosticIssueCount !== null && (!Number.isInteger(scenario.diagnosticIssueCount) || scenario.diagnosticIssueCount <= 0))
			throw new Error(`${path}.diagnosticIssueCount must be null or a positive integer`)
		scenario.executionMode = readEnumerated(scenario.executionMode, executionModes, 'sync', `${path}.executionMode`)
		scenario.entry = readEnumerated(scenario.entry, entries, 'native', `${path}.entry`)
		catalog.set(scenario.id, scenario)
	}
	validateShards(raw, new Set(catalog.keys()))

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
			result.executionMode = readEnumerated(result.executionMode, executionModes, 'sync', `${path}.executionMode`)
			result.entry = readEnumerated(result.entry, entries, 'native', `${path}.entry`)
			// `executionMode` and `entry` are in this list because a row measured with an
			// await inside the timed loop is not the same measurement as one without, and
			// a row that went through the interop entry is not the same call as one that
			// did not. A result disagreeing with its catalog entry is a run that cannot be
			// reported rather than a discrepancy to render.
			for (const field of ['category', 'group', 'resultKind', 'issuePolicy', 'comparisonScope', 'diagnosticIssueCount', 'executionMode', 'entry']) {
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
	return new Intl.NumberFormat('en-US', { maximumFractionDigits })
		.format(value)
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

function scenarioRows(raw, scenario, interpreted) {
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
	})
		.sort((left, right) => right.medianOpsPerSecond - left.medianOpsPerSecond)

	if (rows.length === 0)
		throw new Error(`No adapter measured scenario ${scenario.id}`)
	const fastest = rows[0].medianOpsPerSecond
	const valchecker = rows.find(row => row.adapter === 'valchecker')?.medianOpsPerSecond
	// The interpreted rank is carried on the same row rather than repeated as a
	// second table, so one scenario stays one table while both perspectives from
	// `reportPerspectives` remain readable.
	const interpretedRanks = new Map()
	let interpretedFastest = null
	if (interpreted != null) {
		const interpretedRows = rows.filter(row => isInPerspective(interpreted, row.adapter))
		interpretedRows.forEach((row, index) => interpretedRanks.set(row.adapter, index + 1))
		interpretedFastest = interpretedRows[0]?.medianOpsPerSecond ?? null
	}
	return rows.map((row, index) => ({
		...row,
		rank: index + 1,
		interpretedRank: interpretedRanks.get(row.adapter) ?? null,
		// Measured against the fastest library WITHIN the perspective, so an
		// interpreted row never reports a share of a generated-code number.
		percentOfInterpretedFastest: interpretedFastest != null && interpretedRanks.has(row.adapter)
			? row.medianOpsPerSecond / interpretedFastest * 100
			: null,
		percentOfFastest: row.medianOpsPerSecond / fastest * 100,
		versusValchecker: valchecker ? row.medianOpsPerSecond / valchecker : null,
		unstable: row.relativeMarginOfError > 5,
		// Adaptive sampling means the rows compared here can rest on different
		// numbers of samples. `reachedTarget === false` marks the ones whose
		// interval is wider than the run asked for.
		missedTarget: row.reachedTarget === false,
		sampleCount: row.samples.length,
		// Whether this row stands apart from the one ranked above it. Rows that do
		// not are printed as a ranking the next run would be unlikely to reproduce.
		tiedWithPrevious: index > 0 && !isSeparated(rows[index - 1].medianOpsPerSecond, row.medianOpsPerSecond),
	}))
}

function skippedRows(raw, scenario) {
	return raw.libraries.flatMap((library) => {
		const skipped = library.skippedScenarios.find(item => item.scenario === scenario.id)
		return skipped == null ? [] : [{ library: library.name, reason: skipped.reason }]
	})
}

function samplingDescription(profile) {
	const budget = profile.minSamples === profile.maxSamples
		? `exactly ${profile.maxSamples} samples`
		: `${profile.minSamples} to ${profile.maxSamples} samples, stopping once the 95% interval is within ±${profile.targetRelativeMarginOfError}%`
	return `${profile.warmupMs} ms warmup, ${profile.sampleMs} ms each, ${budget}`
}

function runnerImageOf(environment) {
	return [environment.runnerImageOS, environment.runnerImageVersion]
		.filter(Boolean)
		.join(' ') || 'local'
}

const isolationDescriptions = {
	cell: 'cell — one process per adapter and scenario, so no cell\'s number depends on what ran before it',
	adapter: 'adapter — one process ran every scenario of an adapter, so each cell\'s number depends on its position in that process',
}

/**
 * A machine-describing field, read across the shards. A sharded run has more than
 * one machine, and printing the first shard's CPU as "the" CPU is the mistake this
 * exists to prevent; the shard table below carries the per-shard values.
 */
function acrossShards(raw, read) {
	const values = [...new Set(raw.shards.map(shard => String(read(shard.environment))))]
	return values.length === 1 ? values[0] : 'varies across shards — see Shards'
}

function metadataRows(raw) {
	const shardCount = raw.shards[0].count
	return [
		['Profile', raw.mode],
		['Sampling', samplingDescription(raw.profile)],
		['Isolation', isolationDescriptions[raw.isolation]],
		['Shards', shardCount === 1 ? '1 (whole run on one machine)' : `${shardCount} (scenarios split across ${shardCount} machines)`],
		['Seed', raw.seed],
		['Started', raw.startedAt],
		['Completed', raw.completedAt],
		['Node.js', acrossShards(raw, environment => environment.node)],
		['Platform', acrossShards(raw, environment => `${environment.platform}/${environment.arch}`)],
		['CPU', acrossShards(raw, environment => environment.cpu)],
		['Logical CPUs', acrossShards(raw, environment => environment.logicalCpuCount)],
		['Runner', acrossShards(raw, environment => environment.runnerName ?? 'local')],
		['Runner image', acrossShards(raw, runnerImageOf)],
		['Commit', acrossShards(raw, environment => environment.commit ?? 'local')],
		['Execution order', raw.order.join(' → ')],
	]
}

function shardRows(raw) {
	return [...raw.shards]
		.sort((left, right) => left.index - right.index)
		.map(shard => [
			`${shard.index + 1}/${shard.count}`,
			String(shard.scenarios.length),
			shard.environment.runnerName ?? 'local',
			shard.environment.cpu,
			shard.environment.node,
			shard.startedAt,
			shard.completedAt,
		])
}

/** Which shard measured each scenario, so a scenario section can name its machine. */
function shardByScenario(raw) {
	return new Map(raw.shards.flatMap(shard => shard.scenarios.map(scenario => [scenario, shard])))
}

const shardedWarning = 'This run was sharded: the scenarios below were measured on more than one machine. Compare libraries within a scenario, which is always one machine; do not read one scenario\'s numbers against another\'s, which is invalid here both because the two costs are different work and because the two machines are different hardware. Each section states its shard and the Shards table states each shard\'s runner.'

function interpretedPerspective(raw) {
	const perspectives = reportPerspectives(raw)
	const interpreted = perspectives.find(perspective => perspective.key === INTERPRETED_PERSPECTIVE) ?? null
	if (interpreted === null)
		return { perspective: null, warning: perspectives[0].warning }
	const names = raw.libraries
		.filter(library => interpreted.adapters.has(library.adapter))
		.map(library => library.name)
		.sort()
		.join(', ')
	return { perspective: interpreted, warning: null, names }
}

function renderMarkdown(raw) {
	const { perspective: interpreted, warning, names } = interpretedPerspective(raw)
	const sharded = raw.shards[0].count > 1
	const shards = shardByScenario(raw)
	const lines = [
		'# Valchecker cross-library benchmark report',
		'',
		'> Construction, cold execution, warmed success, and warmed failure-policy groups measure different costs and must not be combined into one overall ranking.',
		'',
		...(sharded ? [`> ${shardedWarning}`, ''] : []),
		...(warning == null ? [] : [`> ${warning}`, '']),
		...(interpreted == null
			? []
			: [`> This run measured a generated-code validator, so every scenario carries two ranks and two shares: **Rank**/**Fastest** over all libraries, and **Rank (interpreted)**/**Fastest (interpreted)** over the libraries that interpret their schemas at execution time (${names}). The concise summary reports both perspectives separately.`, '']),
		'## Run metadata',
		'',
		'| Field | Value |',
		'| --- | --- |',
		...metadataRows(raw)
			.map(([field, value]) => `| ${markdownCell(field)} | ${markdownCell(value)} |`),
		'',
		...(sharded
			? [
					'## Shards',
					'',
					'| Shard | Scenarios | Runner | CPU | Node.js | Started | Completed |',
					'| --- | ---: | --- | --- | --- | --- | --- |',
					...shardRows(raw)
						.map(row => `| ${row.map(markdownCell)
							.join(' | ')} |`),
					'',
				]
			: []),
		'## Results',
		'',
	]

	for (const scenario of raw.scenarioCatalog) {
		const rows = scenarioRows(raw, scenario, interpreted)
		const skipped = skippedRows(raw, scenario)
		const shard = shards.get(scenario.id)
		const conformanceText = scenario.conformanceKey == null
			? ''
			: ` · Conformance: **${scenario.conformanceKey}** (${scenario.conformanceCaseCount} case${scenario.conformanceCaseCount === 1 ? '' : 's'})`
		lines.push(
			`### ${scenario.id}`,
			'',
			`Group: **${scenario.group}** · Result: **${scenario.resultKind}** · Issue policy: **${scenario.issuePolicy}** · Issues: **${scenario.diagnosticIssueCount ?? 'n/a'}** · Comparison scope: **${scenario.comparisonScope}**${conformanceText} · Execution: **${scenario.executionMode}** · Entry: **${scenario.entry}**${sharded ? ` · Shard: **${shard.index + 1}/${shard.count}** on **${shard.environment.runnerName ?? 'local'}**` : ''}`,
			'',
			...(scenario.comparisonNote == null ? [] : [`Execution-model note: ${scenario.comparisonNote}`, '']),
			interpreted == null
				? '| Rank | Library | Version | Median ops/s | Median ns/op | Fastest | vs Valchecker | RME | Samples |'
				: '| Rank | Rank (interpreted) | Library | Version | Median ops/s | Median ns/op | Fastest | Fastest (interpreted) | vs Valchecker | RME | Samples |',
			interpreted == null
				? '| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |'
				: '| ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
			...rows.map(row => `| ${[
				`${row.rank}${row.tiedWithPrevious ? '≈' : ''}`,
				...(interpreted == null ? [] : [row.interpretedRank ?? '—']),
				markdownCell(row.library),
				markdownCell(row.version),
				formatNumber(row.medianOpsPerSecond),
				formatNumber(row.medianNanosecondsPerOperation, 1),
				`${row.percentOfFastest.toFixed(1)}%`,
				...(interpreted == null
					? []
					: [row.percentOfInterpretedFastest === null ? '—' : `${row.percentOfInterpretedFastest.toFixed(1)}%`]),
				row.versusValchecker === null ? 'n/a' : `${row.versusValchecker.toFixed(2)}×`,
				`${row.relativeMarginOfError.toFixed(2)}%${row.unstable ? ' ⚠' : row.missedTarget ? ' †' : ''}`,
				String(row.sampleCount),
			].join(' | ')} |`),
			'',
		)
		if (skipped.length > 0) {
			lines.push(
				`Not ranked: ${skipped.map(item => `${markdownCell(item.library)} — ${markdownCell(item.reason)}`)
					.join('; ')}`,
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
		'- `equivalent` means every participating adapter passed the same executable observable conformance contract before timing; it does not require identical internal implementation. Material execution-model differences are disclosed on the affected row.',
		`- Every cell was measured under **${raw.isolation}** isolation. Under \`cell\` isolation each (adapter, scenario) pair had its own process, so a cell's number does not depend on which scenarios preceded it; a number from an \`adapter\`-isolated run is not comparable with one from a \`cell\`-isolated run.`,
		...(sharded ? [`- ${shardedWarning}`] : []),
		'- An `async` scenario is measured with the await inside the timed loop, so its numbers include the microtask turn an asynchronous caller cannot avoid. Compare an async row only with another async row: they carry their own benchmark groups, and the two named pairings against a synchronous scenario are stated in `scenarios/async.mjs`.',
		'- A `standard` entry scenario calls `schema[\'~standard\'].validate(input)` instead of the library\'s own parse, over the same schema and fixture as the native scenario sharing its build key. The pair is what shows the interop cost.',
		'- Treat results with RME above 5% as unstable and rerun before drawing conclusions.',
		`- \`≈\` marks a row within ${separationThresholdPercent}% of the one above it. Orderings that close are not reproducible: comparing four full runs, most of the pairs that changed places between runs were this close. Read them as unseparated rather than as a rank.`,
		'- Sampling stops once a measurement reaches the profile\'s precision target, so the rows compared within a scenario can rest on different numbers of samples; the Samples column says how many, and `†` marks a measurement whose interval stayed wider than the target.',
		'- The RME of a measurement that stopped early is the value at the moment it first crossed the target, so it is at most the target by construction and understates the spread a longer run would have found.',
		'- The raw JSON artifact remains the source of truth for every sample and skipped-adapter reason.',
		'',
	)
	return `${lines.join('\n')}\n`
}

function renderHtml(raw) {
	const { perspective: interpreted } = interpretedPerspective(raw)
	const sharded = raw.shards[0].count > 1
	const shards = shardByScenario(raw)
	const metadata = metadataRows(raw)
		.map(([field, value]) => `<tr><th>${htmlEscape(field)}</th><td>${htmlEscape(value)}</td></tr>`)
		.join('')
	const shardTable = sharded
		? `<h2>Shards</h2><div class="table-wrap"><table><thead><tr><th class="text">Shard</th><th>Scenarios</th><th class="text">Runner</th><th class="text">CPU</th><th class="text">Node.js</th><th class="text">Started</th><th class="text">Completed</th></tr></thead><tbody>${shardRows(raw)
			.map(row => `<tr>${row.map((cell, index) => `<td${index === 1 ? '' : ' class="text"'}>${htmlEscape(cell)}</td>`)
				.join('')}</tr>`)
			.join('')}</tbody></table></div>`
		: ''
	const sections = raw.scenarioCatalog.map((scenario) => {
		const rows = scenarioRows(raw, scenario, interpreted)
		const body = rows.map(row => `<tr${row.unstable ? ' class="unstable"' : ''}><td>${row.rank}${row.tiedWithPrevious ? '≈' : ''}</td>${interpreted == null ? '' : `<td>${row.interpretedRank ?? '—'}</td>`}<td class="text">${htmlEscape(row.library)}</td><td class="text">${htmlEscape(row.version)}</td><td>${formatNumber(row.medianOpsPerSecond)}</td><td>${formatNumber(row.medianNanosecondsPerOperation, 1)}</td><td>${row.percentOfFastest.toFixed(1)}%</td>${interpreted == null ? '' : `<td>${row.percentOfInterpretedFastest === null ? '—' : `${row.percentOfInterpretedFastest.toFixed(1)}%`}</td>`}<td>${row.versusValchecker === null ? 'n/a' : `${row.versusValchecker.toFixed(2)}×`}</td><td>${row.relativeMarginOfError.toFixed(2)}%${row.unstable ? ' ⚠' : row.missedTarget ? ' †' : ''}</td><td>${row.sampleCount}</td></tr>`)
			.join('')
		const skipped = skippedRows(raw, scenario)
		const skippedText = skipped.length === 0
			? ''
			: `<p><strong>Not ranked:</strong> ${skipped.map(item => `${htmlEscape(item.library)} — ${htmlEscape(item.reason)}`)
				.join('; ')}</p>`
		const shard = shards.get(scenario.id)
		const shardText = sharded
			? ` · Shard: <strong>${shard.index + 1}/${shard.count}</strong> on <strong>${htmlEscape(shard.environment.runnerName ?? 'local')}</strong>`
			: ''
		const conformanceText = scenario.conformanceKey == null
			? ''
			: ` · Conformance: <strong>${htmlEscape(scenario.conformanceKey)}</strong> (${scenario.conformanceCaseCount} case${scenario.conformanceCaseCount === 1 ? '' : 's'})`
		const comparisonNote = scenario.comparisonNote == null
			? ''
			: `<p><strong>Execution-model note:</strong> ${htmlEscape(scenario.comparisonNote)}</p>`
		return `<section><h2>${htmlEscape(scenario.id)}</h2><p>Group: <strong>${htmlEscape(scenario.group)}</strong> · Result: <strong>${htmlEscape(scenario.resultKind)}</strong> · Issue policy: <strong>${htmlEscape(scenario.issuePolicy)}</strong> · Issues: <strong>${scenario.diagnosticIssueCount ?? 'n/a'}</strong> · Comparison scope: <strong>${htmlEscape(scenario.comparisonScope)}</strong>${conformanceText} · Execution: <strong>${htmlEscape(scenario.executionMode)}</strong> · Entry: <strong>${htmlEscape(scenario.entry)}</strong>${shardText}</p>${comparisonNote}<div class="table-wrap"><table><thead><tr><th>Rank</th>${interpreted == null ? '' : '<th>Rank (interpreted)</th>'}<th class="text">Library</th><th class="text">Version</th><th>Median ops/s</th><th>Median ns/op</th><th>Fastest</th>${interpreted == null ? '' : '<th>Fastest (interpreted)</th>'}<th>vs Valchecker</th><th>RME</th><th>Samples</th></tr></thead><tbody>${body}</tbody></table></div>${skippedText}</section>`
	})
		.join('')

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Valchecker benchmark report</title>
<style>
:root{font-family:ui-sans-serif,system-ui,sans-serif;color:#1f2937;background:#f8fafc}body{max-width:1180px;margin:0 auto;padding:32px 20px 64px}h1{margin-bottom:8px}h2{margin-top:40px}p,li{line-height:1.5}.notice{padding:12px 16px;border-left:4px solid #64748b;background:#e2e8f0}.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;background:white}th,td{padding:9px 12px;border:1px solid #cbd5e1;text-align:right;white-space:nowrap}th:first-child,td:first-child,.text{text-align:left}thead th{background:#e2e8f0}.metadata{max-width:760px}.metadata th{width:180px}.unstable{background:#fff7ed}
</style>
</head>
<body>
<h1>Valchecker cross-library benchmark report</h1>
<p class="notice">Construction, cold execution, warmed success, and warmed failure-policy groups measure different costs and must not be combined into one overall ranking.</p>
${sharded ? `<p class="notice">${htmlEscape(shardedWarning)}</p>` : ''}
<h2>Run metadata</h2>
<table class="metadata"><tbody>${metadata}</tbody></table>
${shardTable}
${sections}
<h2>Interpretation rules</h2>
<ul><li>Every cell was measured under <strong>${htmlEscape(raw.isolation)}</strong> isolation; a number from a <code>cell</code>-isolated run is not comparable with one from an <code>adapter</code>-isolated run.</li><li>Compare libraries only within the same scenario, benchmark group, and issue policy.</li><li>Library-default failures are not diagnostic-work-equivalent.</li><li>Explicit first/all scenarios verify issue counts and omit unsupported adapters.</li><li>Compatible-subset scenarios test only common behavior.</li><li>Equivalent scenarios passed the same executable observable conformance contract before timing; internal implementation may differ, and material differences are disclosed on the row.</li><li>An async scenario is measured with the await inside the timed loop and belongs to its own benchmark group; compare it only with another async row.</li><li>A standard-entry scenario calls <code>~standard.validate</code> over the same schema as the native scenario sharing its build key.</li><li>&#8776; marks a row the run does not separate from the one above it.</li><li>RME above 5% is unstable (&#9888;). A dagger (&#8224;) marks a measurement whose interval stayed wider than the profile's target.</li><li>The raw JSON remains the source of truth.</li></ul>
</body>
</html>
`
}

const options = parseArguments(process.argv.slice(2))
// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM benchmark entry script executed to completion at load
const raw = validateResult(JSON.parse(await readFile(options.input, 'utf8')))
const markdown = renderMarkdown(raw)
const html = renderHtml(raw)
// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM benchmark entry script executed to completion at load
await Promise.all([
	mkdir(dirname(options.markdown), { recursive: true }),
	mkdir(dirname(options.html), { recursive: true }),
])
// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM benchmark entry script executed to completion at load
await Promise.all([
	writeFile(options.markdown, markdown),
	writeFile(options.html, html),
])
console.error(`[benchmark] wrote ${options.markdown}`)
console.error(`[benchmark] wrote ${options.html}`)
