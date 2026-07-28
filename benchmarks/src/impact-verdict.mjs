/**
 * The before/after verdict: aggregation, classification, group trade-offs, and the two
 * reports. Everything here is a pure function of parsed result objects, which is what
 * `compare.mjs` is not — it reads files, writes files, and sets an exit code, and a
 * script shaped like that cannot be unit tested without a filesystem. The severe-group
 * trigger and the notes about where it does not apply are the part of this gate a
 * reader trusts most, so they live where a test can reach them, the same reason
 * `separation.mjs` and `comparability.mjs` were split out.
 */
import { assertComparable, measurementIdentity } from './comparability.mjs'
import { median, relativeMarginOfError } from './statistics.mjs'

export const stabilityThreshold = 5
export const meaningfulThreshold = 5
export const severeScenarioRegression = -10
export const severeGroupRegression = -5

/** The trigger needs this many stable scenarios in a group before it can fire. */
export const minimumStableScenariosPerGroup = 2

function getValchecker(raw, label) {
	if (!raw || typeof raw !== 'object' || !Array.isArray(raw.libraries))
		throw new TypeError(`${label} benchmark result is invalid`)
	const library = raw.libraries.find(item => item.adapter === 'valchecker')
	if (!library)
		throw new Error(`${label} result does not contain valchecker`)
	return library
}

const comparedMetadata = ['category', 'group', 'resultKind', 'issuePolicy', 'comparisonScope', 'diagnosticIssueCount']

export function aggregateRuns(raws, label) {
	const mode = raws[0].mode
	const identity = measurementIdentity(raws[0], `${label} run 1`)
	const first = getValchecker(raws[0], label)
	const resultMaps = raws.map((raw, index) => {
		assertComparable(identity, measurementIdentity(raw, `${label} run ${index + 1}`), `${label} run 1 and ${label} run ${index + 1}`)
		return new Map(getValchecker(raw, `${label} run ${index + 1}`).results.map(result => [result.scenario, result]))
	})
	const results = first.results.map((template) => {
		const runResults = resultMaps.map((resultMap) => {
			const result = resultMap.get(template.scenario)
			if (!result)
				throw new Error(`${label} run is missing ${template.scenario}`)
			for (const field of comparedMetadata) {
				if (result[field] !== template[field])
					throw new Error(`${label} metadata mismatch for ${template.scenario}.${field}`)
			}
			return result
		})
		const runMedians = runResults.map(result => result.medianOpsPerSecond)
		return {
			scenario: template.scenario,
			category: template.category,
			group: template.group,
			resultKind: template.resultKind,
			issuePolicy: template.issuePolicy,
			comparisonScope: template.comparisonScope,
			diagnosticIssueCount: template.diagnosticIssueCount,
			medianOpsPerSecond: median(runMedians),
			crossRunRme: relativeMarginOfError(runMedians),
			runMedians,
			withinRunRme: runResults.map(result => result.relativeMarginOfError),
		}
	})
	return {
		mode,
		identity,
		runCount: raws.length,
		commits: [...new Set(raws.map(raw => raw.environment?.commit ?? null))],
		results,
	}
}

function geometricMean(values) {
	return values.length === 0
		? null
		: Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length)
}

export function formatDelta(value) {
	const percentage = value * 100
	return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(1)}%`
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

function coveragePercent(measured, total) {
	return total === 0 ? 100 : Math.round(measured / total * 100)
}

/**
 * Why a partly covered group is reported as covered-in-part rather than as a trigger
 * that could not apply.
 *
 * A scoped run measures 5 of `warm/success`'s 113 scenarios, and calling the resulting
 * geometric mean "cleared" without saying so reads as coverage of the group. The fix is
 * the denominator, not a coverage threshold that flips the trigger to unavailable:
 *
 * - the scenarios a scoped run leaves out are the ones the diff cannot move. That is the
 *   selection's premise, defended by an import graph whose default for anything it
 *   cannot place is a full run. A regression in an unmeasured scenario would need a
 *   changed file reaching it, which would have selected it;
 * - scoping makes this aggregate *more* sensitive, not less. Two regressing scenarios
 *   among five move a geometric mean that 111 unaffected ones would have flattened, so a
 *   coverage floor would disable the trigger exactly where it discriminates best;
 * - declaring a trigger unavailable cannot catch anything. It converts a pass into an
 *   unknown, and the unknown it produces would be wrong in the common case above.
 *
 * What is genuinely unavailable is a trigger with fewer than two *stable* scenarios, and
 * that is reported separately and by name. What a reader must not have to guess is how
 * much of a group ran, which is why every group row carries `measured/total` and the
 * report says outright that a scoped aggregate is not comparable with an unscoped one.
 */
function summarizeGroups(rows, groupTotals) {
	return [...new Set(rows.map(row => row.group))].map((group) => {
		const groupRows = rows.filter(row => row.group === group)
		const stableRows = groupRows.filter(row => row.stable)
		const ratio = geometricMean(stableRows.map(row => row.ratio))
		return {
			group,
			scenarios: groupRows.length,
			// The scenarios this group has in the profile's tier. A selection can name a
			// scenario from a richer tier than the mode's, so the measured count is the
			// floor: a denominator smaller than the numerator would be a reporting bug
			// standing in for a selection fact.
			catalogScenarios: Math.max(groupTotals.get(group) ?? 0, groupRows.length),
			stableScenarios: stableRows.length,
			ratio,
			delta: ratio == null ? null : ratio - 1,
		}
	})
}

/** Group totals for one tier, keyed by group name. */
export function groupTotalsOf(catalog) {
	const totals = new Map()
	for (const scenario of catalog)
		totals.set(scenario.group, (totals.get(scenario.group) ?? 0) + 1)
	return totals
}

export function compareResults(baseline, candidate, { groupTotals }) {
	// The single comparability guard, covering mode, profile, isolation, shard count, and
	// the scenario selection. A difference in any of them means the gap between the two
	// runs is not attributable to the change under test.
	assertComparable(baseline.identity, candidate.identity, 'Baseline and candidate')
	if (baseline.runCount !== candidate.runCount)
		throw new Error('Aggregated run counts differ')

	const candidateByScenario = new Map(candidate.results.map(result => [result.scenario, result]))
	const rows = baseline.results.map((base) => {
		const head = candidateByScenario.get(base.scenario)
		if (!head)
			throw new Error(`Candidate is missing scenario ${base.scenario}`)
		for (const field of comparedMetadata) {
			if (head[field] !== base[field])
				throw new Error(`Metadata mismatch for ${base.scenario}.${field}`)
		}
		const pairedRatios = head.runMedians.map((value, index) => value / base.runMedians[index])
		const ratio = median(pairedRatios)
		const delta = ratio - 1
		const pairedRme = relativeMarginOfError(pairedRatios)
		const stable = pairedRme <= stabilityThreshold
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
			group: base.group,
			resultKind: base.resultKind,
			issuePolicy: base.issuePolicy,
			comparisonScope: base.comparisonScope,
			diagnosticIssueCount: base.diagnosticIssueCount,
			baselineOps: base.medianOpsPerSecond,
			candidateOps: head.medianOpsPerSecond,
			baselineCrossRunRme: base.crossRunRme,
			candidateCrossRunRme: head.crossRunRme,
			pairedRme,
			pairedRatios,
			ratio,
			delta,
			stable,
			classification,
			baselineRunMedians: base.runMedians,
			candidateRunMedians: head.runMedians,
		}
	})
	if (candidateByScenario.size !== rows.length)
		throw new Error('Candidate contains scenarios absent from baseline')

	const groups = summarizeGroups(rows, groupTotals)

	const severeScenarios = rows.filter(row => row.stable && row.delta * 100 <= severeScenarioRegression)
	const severeGroups = groups.filter(row => row.delta != null && row.stableScenarios >= minimumStableScenariosPerGroup && row.delta * 100 <= severeGroupRegression)
	// The trigger that catches a broad moderate regression needs two stable scenarios
	// in the group. A group that has fewer is not covered by it, and the verdict says
	// so rather than reading as a group the trigger cleared.
	const groupsWithoutTrigger = groups.filter(row => row.stableScenarios < minimumStableScenariosPerGroup)
		.map(row => row.group)
	// The groups whose aggregate is over part of the group. Named for the same reason:
	// `2/2 stable` says nothing about whether the group has 2 scenarios or 113.
	const partiallyCoveredGroups = groups.filter(row => row.scenarios < row.catalogScenarios)
		.map(row => ({ group: row.group, measured: row.scenarios, total: row.catalogScenarios }))
	const improvements = rows.filter(row => row.classification === 'improvement')
	const regressions = rows.filter(row => row.classification === 'regression')
	const verdict = severeScenarios.length > 0 || severeGroups.length > 0
		? 'regression'
		: regressions.length > 0 && improvements.length > 0
			? 'tradeoff-review'
			: regressions.length > 0
				? 'review'
				: improvements.length > 0
					? 'improvement'
					: 'neutral'

	return {
		// 6 because `groups[].catalogScenarios`, `partiallyCoveredGroups`,
		// `groupsWithoutTrigger`, and `measurement.selection` were added; a reader of a
		// stored report must be able to tell whether the absence of a scope note means
		// full coverage or an older tool that could not report it.
		schemaVersion: 6,
		mode: baseline.mode,
		// The measurement identity both sides had to share, recorded so the verdict
		// carries the conditions it was reached under rather than only the numbers.
		measurement: {
			isolation: baseline.identity.isolation,
			shardCount: baseline.identity.shardCount,
			selection: baseline.identity.selection,
		},
		// How much of the tier ran. Without it a reader of a passing report cannot tell a
		// complete comparison from a scoped one, and `2/2 stable` in a group reads the
		// same whether the group has two scenarios or a hundred and thirteen.
		coverage: {
			measuredScenarios: rows.length,
			tierScenarios: Math.max([...groupTotals.values()].reduce((sum, count) => sum + count, 0), rows.length),
		},
		runCounts: { baseline: baseline.runCount, candidate: candidate.runCount },
		commits: { baseline: baseline.commits, candidate: candidate.commits },
		thresholds: {
			stabilityPairedRmePercent: stabilityThreshold,
			meaningfulChangePercent: meaningfulThreshold,
			severeScenarioRegressionPercent: Math.abs(severeScenarioRegression),
			severeGroupRegressionPercent: Math.abs(severeGroupRegression),
			minimumStableScenariosPerGroup,
		},
		verdict,
		counts: {
			improvements: improvements.length,
			regressions: regressions.length,
			neutral: rows.filter(row => row.classification === 'neutral').length,
			unstable: rows.filter(row => row.classification === 'unstable').length,
		},
		groups,
		rows,
		severeScenarios: severeScenarios.map(row => row.scenario),
		severeGroups: severeGroups.map(row => row.group),
		groupsWithoutTrigger,
		partiallyCoveredGroups,
	}
}

export function renderMarkdown(result) {
	const lines = [
		'# Valchecker benchmark impact',
		'',
		`Verdict: **${result.verdict}** · Paired process runs: **${result.runCounts.baseline}** · Isolation: **${result.measurement.isolation}** · Shards: **${result.measurement.shardCount}**`,
		'',
		`Scenarios measured: **${result.coverage.measuredScenarios} of ${result.coverage.tierScenarios}** in the \`${result.mode}\` tier`
		+ `${result.measurement.selection == null ? ' (unscoped)' : ' (scoped to the diff)'}.`,
		'',
		`Meaningful change requires at least **${meaningfulThreshold}%** with paired-ratio RME at or below **${stabilityThreshold}%**.`,
		'',
		'## Benchmark-group tradeoffs',
		'',
		'| Group | Scenarios measured | Stable | Geometric mean change |',
		'| --- | ---: | ---: | ---: |',
	]
	for (const row of result.groups) {
		lines.push(
			`| ${markdownCell(row.group)} `
			+ `| ${row.scenarios}/${row.catalogScenarios} (${coveragePercent(row.scenarios, row.catalogScenarios)}%) `
			+ `| ${row.stableScenarios}/${row.scenarios} `
			+ `| ${row.delta == null ? 'n/a' : formatDelta(row.delta)} |`,
		)
	}

	if (result.partiallyCoveredGroups.length > 0) {
		lines.push(
			'',
			`> **Partly covered groups.** ${result.partiallyCoveredGroups.map(row => `\`${row.group}\` ${row.measured}/${row.total}`)
				.join(', ')}. A group's geometric mean is over the scenarios this run measured, not over the group, `
				+ 'so it is not comparable with an unscoped run\'s and it cannot contain a regression in a scenario that did not run. '
				+ 'The scenarios left out are the ones the diff cannot reach; the **Scenario scope** section states which paths that conclusion rests on.',
		)
	}

	if (result.groupsWithoutTrigger.length > 0) {
		lines.push(
			'',
			`> **No severe-group trigger** for ${result.groupsWithoutTrigger.map(group => `\`${group}\``)
				.join(', ')}. It needs at least ${minimumStableScenariosPerGroup} stable scenarios in a group, and these have fewer, `
				+ 'so a broad moderate regression inside one of them is watched only by the per-scenario 10% threshold.',
		)
	}

	lines.push(
		'',
		'## Scenario changes',
		'',
		'| Scenario | Group | Issue policy | Issues | Baseline ops/s | Candidate ops/s | Change | Paired RME | Classification |',
		'| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |',
	)
	for (const row of [...result.rows].sort((left, right) => left.delta - right.delta)) {
		lines.push(`| ${markdownCell(row.scenario)} | ${markdownCell(row.group)} | ${markdownCell(row.issuePolicy)} | ${row.diagnosticIssueCount ?? 'n/a'} | ${Math.round(row.baselineOps)
			.toLocaleString('en-US')} | ${Math.round(row.candidateOps)
			.toLocaleString('en-US')} | ${formatDelta(row.delta)} | ${row.pairedRme.toFixed(2)}% | ${row.classification} |`)
	}

	lines.push(
		'',
		'## Decision rubric',
		'',
		'- Each observation is a candidate/base ratio from adjacent independent processes; the reported change is the median paired ratio.',
		'- Paired RME uses a 95% Student’s t interval, which is intentionally conservative for three process pairs.',
		'- Below 3% is normally noise; 3–5% needs corroboration; at least 5% with paired RME ≤5% is meaningful.',
		'- Group-level gates keep success, library-default failure, first-issue failure, and all-issues failure tradeoffs separate.',
		'- A group aggregate covers the scenarios that ran; read it with the coverage column beside it.',
		'- Construction or fresh-schema regressions require documented warm-path amortization.',
		'- Added complexity or bundle size should normally buy at least 10% in a representative hot path or broad gains.',
		'- Correctness, API stability, coverage, and package integrity remain hard constraints.',
		'',
	)
	return `${lines.join('\n')}\n`
}

export function renderHtml(result) {
	const groups = result.groups.map(row => `<tr><td>${htmlEscape(row.group)}</td><td>${row.scenarios}/${row.catalogScenarios} (${coveragePercent(row.scenarios, row.catalogScenarios)}%)</td><td>${row.stableScenarios}/${row.scenarios}</td><td>${row.delta == null ? 'n/a' : formatDelta(row.delta)}</td></tr>`)
		.join('')
	const rows = [...result.rows].sort((left, right) => left.delta - right.delta)
		.map(row => `<tr><td>${htmlEscape(row.scenario)}</td><td>${htmlEscape(row.group)}</td><td>${htmlEscape(row.issuePolicy)}</td><td>${row.diagnosticIssueCount ?? 'n/a'}</td><td>${Math.round(row.baselineOps)
			.toLocaleString('en-US')}</td><td>${Math.round(row.candidateOps)
			.toLocaleString('en-US')}</td><td>${formatDelta(row.delta)}</td><td>${row.pairedRme.toFixed(2)}%</td><td>${htmlEscape(row.classification)}</td></tr>`)
		.join('')
	const scope = result.partiallyCoveredGroups.length === 0
		? ''
		: `<p><strong>Partly covered groups:</strong> ${htmlEscape(result.partiallyCoveredGroups.map(row => `${row.group} ${row.measured}/${row.total}`)
			.join(', '))}. A group's geometric mean is over the scenarios this run measured.</p>`
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Benchmark impact</title><style>:root{font-family:ui-sans-serif,system-ui,sans-serif;color:#1f2937;background:#f8fafc}body{max-width:1260px;margin:0 auto;padding:32px 20px 64px}table{border-collapse:collapse;width:100%;background:#fff;margin-bottom:28px}th,td{padding:9px 12px;border:1px solid #cbd5e1;text-align:right}th:first-child,td:first-child,th:nth-child(2),td:nth-child(2),th:nth-child(3),td:nth-child(3){text-align:left}th{background:#e2e8f0}li{line-height:1.5}</style></head><body><h1>Valchecker benchmark impact</h1><p>Verdict: <strong>${htmlEscape(result.verdict)}</strong> · Paired process runs: ${result.runCounts.baseline} · Isolation: <strong>${htmlEscape(result.measurement.isolation)}</strong> · Shards: ${result.measurement.shardCount}</p>${scope}<h2>Benchmark-group tradeoffs</h2><table><thead><tr><th>Group</th><th>Scenarios measured</th><th>Stable scenarios</th><th>Change</th></tr></thead><tbody>${groups}</tbody></table><h2>Scenario changes</h2><table><thead><tr><th>Scenario</th><th>Group</th><th>Issue policy</th><th>Issues</th><th>Baseline ops/s</th><th>Candidate ops/s</th><th>Change</th><th>Paired RME</th><th>Classification</th></tr></thead><tbody>${rows}</tbody></table></body></html>\n`
}
