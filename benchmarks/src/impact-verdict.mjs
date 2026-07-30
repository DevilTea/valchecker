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
import { mean, median, relativeMarginOfError } from './statistics.mjs'

/**
 * A **reported diagnostic**, not the gate's decision input.
 *
 * It used to be the decision: a row counted only when `pairedRme <= 5`, and a row that
 * did not count could not produce a regression verdict — which #124 named outright as
 * "an unclassified scenario cannot produce a regression verdict — it is a silent
 * pass." Two measurements showed why that had to go rather than be tuned. A row
 * reading −12% with 6% RME has an interval of about [−18%, −6%], every value in it a
 * regression, and the old rule passed it in silence. And the verdict itself was
 * unreliable in the other direction: re-running one identical configuration on a hosted
 * runner moved 54 of 170 cells across this threshold — 47 imprecise in one run against
 * 21 in the other, same commit, same parameters — so a run's coverage was partly a
 * property of the runner it drew.
 *
 * It stays reported because how precise a measurement is remains worth seeing; it no
 * longer decides anything.
 */
export const stabilityThreshold = 5

export const meaningfulThreshold = 5
export const severeScenarioRegression = -10
export const severeGroupRegression = -5

/** The trigger needs this many decisive rows in a group before it can fire. */
export const minimumDecisiveScenariosPerGroup = 2

function getValchecker(raw, label) {
	if (!raw || typeof raw !== 'object' || !Array.isArray(raw.libraries))
		throw new TypeError(`${label} benchmark result is invalid`)
	const library = raw.libraries.find(item => item.adapter === 'valchecker')
	if (!library)
		throw new Error(`${label} result does not contain valchecker`)
	return library
}

const comparedMetadata = ['category', 'group', 'resultKind', 'issuePolicy', 'comparisonScope', 'diagnosticIssueCount']

/** The cells a run could not execute against the build it measured, by name. */
function unmeasurableOf(raw) {
	return [...new Set((raw.unmeasurableCells ?? []).map(entry => entry.cell))].sort()
}

export function aggregateRuns(raws, label) {
	const mode = raws[0].mode
	const identity = measurementIdentity(raws[0], `${label} run 1`)
	const first = getValchecker(raws[0], label)
	const unmeasurable = unmeasurableOf(raws[0])
	const resultMaps = raws.map((raw, index) => {
		assertComparable(identity, measurementIdentity(raw, `${label} run ${index + 1}`), `${label} run 1 and ${label} run ${index + 1}`)
		// The repetitions of one side measured one build with one apparatus, so which cells
		// have numbers cannot legitimately vary between them: `verifyCell` decides it, and it
		// decides it the same way every time. A difference means one repetition measured
		// something else, and the rows below would be built from the first repetition's cell
		// set while a later one contributed a different set of paired ratios.
		if (unmeasurableOf(raw)
			.join(',') !== unmeasurable.join(',')) {
			throw new Error(`${label} run ${index + 1} reports different unmeasurable cells than ${label} run 1`)
		}
		const results = getValchecker(raw, `${label} run ${index + 1}`).results
		if (results.length !== first.results.length)
			throw new Error(`${label} run ${index + 1} measured ${results.length} scenarios and ${label} run 1 measured ${first.results.length}`)
		return new Map(results.map(result => [result.scenario, result]))
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
		/** Cells this side declared but could not execute against its own build. */
		unmeasurable,
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

/** A row's 95% interval, as the pair of changes it spans. */
export function formatInterval(row) {
	return Number.isFinite(row.intervalLow) && Number.isFinite(row.intervalHigh)
		? `${formatDelta(row.intervalLow)} … ${formatDelta(row.intervalHigh)}`
		: 'unbounded'
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
 * What is genuinely unavailable is a trigger with fewer than two *decisive* rows, and
 * that is reported separately and by name. What a reader must not have to guess is how
 * much of a group ran, which is why every group row carries `measured/total` and the
 * report says outright that a scoped aggregate is not comparable with an unscoped one.
 */
function summarizeGroups(rows, groupTotals) {
	return [...new Set(rows.map(row => row.group))].map((group) => {
		const groupRows = rows.filter(row => row.group === group)
		// Decisive rows, not precise ones. A row whose interval settles the question
		// belongs in the aggregate whichever side of the threshold it settled on, and
		// improvements are included with the rest: dropping them would leave a mean over
		// regressions and cleared rows only, which is biased toward firing the trigger on
		// what is really a trade-off.
		const decisiveRows = groupRows.filter(row => row.decisive)
		const ratio = geometricMean(decisiveRows.map(row => row.ratio))
		return {
			group,
			scenarios: groupRows.length,
			// The scenarios this group has in the profile's tier. A selection can name a
			// scenario from a richer tier than the mode's, so the measured count is the
			// floor: a denominator smaller than the numerator would be a reporting bug
			// standing in for a selection fact.
			catalogScenarios: Math.max(groupTotals.get(group) ?? 0, groupRows.length),
			decisiveScenarios: decisiveRows.length,
			/** How many rows the retry pass would have to settle before this group is fully judged. */
			inconclusiveScenarios: groupRows.length - decisiveRows.length,
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

/**
 * One row's verdict, taken against the **interval** rather than the point estimate.
 *
 * The gate used to ask two separate questions — is this estimate precise, and is the
 * point estimate past the threshold — when the question it needs answered is one: *can a
 * regression be ruled out?* Asking it as two produced errors in both directions, and both
 * were measured rather than argued:
 *
 * - a **false positive that precision did not catch.** In a hosted-runner null run
 *   (`before == after`, so every non-neutral result is false by construction) the gate
 *   returned `review` and called `construct/tuple` a regression at −5.32% with a paired
 *   RME of 3.12%: precise by the old test, and wrong. Its interval is about
 *   [−8.3%, −2.4%], which spans −5%, so the honest answer is that this run cannot tell a
 *   5% regression from noise on that cell. Under this rule it is `inconclusive`.
 * - a **false negative that precision caused.** A row at −12% with 6% RME has an interval
 *   of about [−18%, −6%]: every value in it is a regression, and the old rule discarded it
 *   for imprecision and passed.
 *
 * The four largest false deltas of the same null runs (+14.88% at 19.47 RME, −7.71% at
 * 15.72, −6.07% at 6.15, −5.64% at 11.09) all have intervals spanning everything, so all
 * four land `inconclusive` here — which is what a run that cannot judge them should say.
 *
 * The interval is centred on the mean of the paired ratios, because that is what
 * `relativeMarginOfError` is the half-width *of* — a t interval for the mean. The
 * reported `delta` stays the median, which is the robust point estimate the report has
 * always shown; where the two disagree the classification is the conservative one,
 * because every rule below requires the whole interval to be on one side of a threshold.
 *
 * `severe` additionally requires the point estimate past −10%, so the one rule that fails
 * the build keeps its stated meaning. It is still strictly more sensitive than the rule it
 * replaces, which demanded precision on top.
 */
function classifyRow(pairedRatios, ratio) {
	const centre = mean(pairedRatios)
	const halfWidth = relativeMarginOfError(pairedRatios) / 100 * Math.abs(centre)
	const low = centre - halfWidth - 1
	const high = centre + halfWidth - 1
	const meaningful = meaningfulThreshold / 100
	const delta = ratio - 1

	if (high <= -meaningful) {
		return {
			low,
			high,
			decisive: true,
			classification: delta <= severeScenarioRegression / 100 ? 'severe' : 'regression',
		}
	}
	if (low >= meaningful)
		return { low, high, decisive: true, classification: 'improvement' }
	if (low > -meaningful && high < meaningful)
		return { low, high, decisive: true, classification: 'cleared' }
	return { low, high, decisive: false, classification: 'inconclusive' }
}

export function compareResults(baseline, candidate, { groupTotals, catalogHash = null }) {
	// The single comparability guard, covering mode, profile, isolation, shard count, the cell
	// catalog, and the scenario selection. A difference in any of them means the gap between
	// the two runs is not attributable to the change under test.
	assertComparable(baseline.identity, candidate.identity, 'Baseline and candidate')
	if (baseline.runCount !== candidate.runCount)
		throw new Error('Aggregated run counts differ')
	// And the catalog the denominators come from is the catalog the runs were measured
	// against. It is a separate file now — persisted during measurement rather than
	// re-derived here — so the one thing that could go wrong is reading a stale one, and a
	// stale catalog would misstate every group's coverage without changing a single number.
	if (catalogHash !== baseline.identity.cellCatalogHash) {
		throw new Error(
			`The cell catalog supplied to the comparison is ${String(catalogHash)} but the runs were measured against ${String(baseline.identity.cellCatalogHash)}. `
			+ 'Group denominators and coverage would describe a different cell set than the one that was measured.',
		)
	}

	const candidateByScenario = new Map(candidate.results.map(result => [result.scenario, result]))
	// The cells with a number on both sides. A cell present on one side only cannot produce a
	// paired ratio, and it is not an error: a cell that executes against one build and not the
	// other is how a step arrives or leaves, which is what the presence counts below report.
	// It is never dropped in silence — every one of them is named.
	const paired = baseline.results.filter(base => candidateByScenario.has(base.scenario))
	const baselineIds = new Set(baseline.results.map(result => result.scenario))
	const presence = {
		measured: paired.length,
		added: candidate.results.filter(result => !baselineIds.has(result.scenario))
			.map(result => result.scenario)
			.sort(),
		removed: baseline.results.filter(result => !candidateByScenario.has(result.scenario))
			.map(result => result.scenario)
			.sort(),
	}
	const rows = paired.map((base) => {
		const head = candidateByScenario.get(base.scenario)
		for (const field of comparedMetadata) {
			if (head[field] !== base[field])
				throw new Error(`Metadata mismatch for ${base.scenario}.${field}`)
		}
		const pairedRatios = head.runMedians.map((value, index) => value / base.runMedians[index])
		const ratio = median(pairedRatios)
		const delta = ratio - 1
		const pairedRme = relativeMarginOfError(pairedRatios)
		const classified = classifyRow(pairedRatios, ratio)
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
			/** The 95% interval the same repetitions establish, as a change like `delta`. */
			intervalLow: classified.low,
			intervalHigh: classified.high,
			/** Diagnostic only: whether the estimate met the reported precision threshold. */
			precise: pairedRme <= stabilityThreshold,
			/** Whether the interval settled the question, either way. */
			decisive: classified.decisive,
			classification: classified.classification,
			baselineRunMedians: base.runMedians,
			candidateRunMedians: head.runMedians,
		}
	})
	const groups = summarizeGroups(rows, groupTotals)

	const severeScenarios = rows.filter(row => row.classification === 'severe')
	const severeGroups = groups.filter(row => row.delta != null && row.decisiveScenarios >= minimumDecisiveScenariosPerGroup && row.delta * 100 <= severeGroupRegression)
	// The trigger that catches a broad moderate regression needs two decisive rows in
	// the group. A group that has fewer is not covered by it, and the verdict says so
	// rather than reading as a group the trigger cleared.
	const groupsWithoutTrigger = groups.filter(row => row.decisiveScenarios < minimumDecisiveScenariosPerGroup)
		.map(row => row.group)
	// The groups whose aggregate is over part of the group. Named for the same reason:
	// `2/2 decisive` says nothing about whether the group has 2 scenarios or 113.
	const partiallyCoveredGroups = groups.filter(row => row.scenarios < row.catalogScenarios)
		.map(row => ({ group: row.group, measured: row.scenarios, total: row.catalogScenarios }))
	const improvements = rows.filter(row => row.classification === 'improvement')
	// Severe rows are regressions too; the count is of everything the interval rule
	// settled on the regression side, so it can never read as smaller than `severeScenarios`.
	const regressions = rows.filter(row => row.classification === 'regression' || row.classification === 'severe')
	// The retry input, and the one list a reader of a passing gate most needs. These are
	// the rows this run could not judge — not rows it cleared. `inconclusive` is not a
	// pass, and the verdict below refuses to call a run with any of them `neutral`.
	const inconclusiveScenarios = rows.filter(row => row.classification === 'inconclusive')
		.map(row => row.scenario)
	const verdict = severeScenarios.length > 0 || severeGroups.length > 0
		? 'regression'
		: regressions.length > 0 && improvements.length > 0
			? 'tradeoff-review'
			: regressions.length > 0
				? 'review'
				: improvements.length > 0
					? 'improvement'
					// A run with unsettled rows is not `neutral`. It is reported as
					// `inconclusive` so nothing downstream can read it as a clean sweep, and the
					// rows are named so the retry pass has an input. It does not by itself fail
					// the job: `--fail-on-regression` fails on a regression verdict, and making
					// an unsettled row fail the build would turn a runner's noise — 54 of 170
					// cells moved across the old precision threshold between two identical
					// hosted-runner runs — into a red gate on pull requests that changed nothing.
					// Not a pass and not a failure: an answer the gate does not have yet.
					: inconclusiveScenarios.length > 0
						? 'inconclusive'
						: 'neutral'

	return {
		// 8 because `cells` was added: a reader of a stored report must be able to tell
		// whether the absence of the presence counts means nothing was added or removed, or
		// an older tool that could not compute them.
		schemaVersion: 8,
		mode: baseline.mode,
		// The measurement identity both sides had to share, recorded so the verdict
		// carries the conditions it was reached under rather than only the numbers.
		measurement: {
			isolation: baseline.identity.isolation,
			shardCount: baseline.identity.shardCount,
			selection: baseline.identity.selection,
			cellCatalogHash: baseline.identity.cellCatalogHash,
		},
		/**
		 * `measured N / added M / removed K`, reported whether or not any of them is zero.
		 *
		 * It is computable now because the catalog is a persisted artifact rather than a
		 * collection this stage performs: the comparison knows the whole cell set, which side
		 * measured each cell, and which cells each side could not execute at all. A count that
		 * only appeared when it was non-zero would leave a reader of a clean report unable to
		 * tell a complete comparison from one whose cell set moved under it.
		 *
		 * What each number means, precisely. `measured` is the cells with a number on both
		 * sides, which is the only kind that can produce a paired ratio. `added` executed
		 * against the candidate build and not the baseline's — a new step's cells, most often.
		 * `removed` executed against the baseline and not the candidate's, which is a cell
		 * whose subject stopped working, so unlike `added` it is worth reading twice.
		 *
		 * One ceiling, stated rather than left to be discovered: the cell *definitions* come
		 * from the checked-out ref only, because they are the apparatus. A cell deleted from
		 * the candidate tree is therefore not in the catalog at all and appears in none of
		 * these counts. What they see is a cell that exists and cannot run.
		 */
		cells: {
			catalogHash,
			catalogCells: groupTotals.size === 0 ? null : [...groupTotals.values()].reduce((sum, count) => sum + count, 0),
			measured: presence.measured,
			added: presence.added,
			removed: presence.removed,
			baselineUnmeasurable: baseline.unmeasurable,
			candidateUnmeasurable: candidate.unmeasurable,
		},
		// How much of the tier ran. Without it a reader of a passing report cannot tell a
		// complete comparison from a scoped one, and `2/2 decisive` in a group reads the
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
			minimumDecisiveScenariosPerGroup,
		},
		verdict,
		counts: {
			improvements: improvements.length,
			regressions: regressions.length,
			cleared: rows.filter(row => row.classification === 'cleared').length,
			severe: severeScenarios.length,
			inconclusive: inconclusiveScenarios.length,
			// Diagnostic only, and reported beside the classifications rather than inside
			// them: how many rows met the precision threshold that used to be the gate.
			imprecise: rows.filter(row => !row.precise).length,
		},
		groups,
		rows,
		severeScenarios: severeScenarios.map(row => row.scenario),
		severeGroups: severeGroups.map(row => row.group),
		// The retry input. A second pass measures exactly these rows for k more paired
		// repetitions, pools them with the first pass, and judges once — never taking the
		// better of two results, and never re-judging a row that was already decisive.
		inconclusiveScenarios,
		groupsWithoutTrigger,
		partiallyCoveredGroups,
	}
}

function nameList(ids, format) {
	return ids.slice(0, 12)
		.map(format)
		.join(', ') + (ids.length > 12 ? `, and ${ids.length - 12} more` : '')
}

/**
 * The presence line, printed on every report.
 *
 * Unconditional is the point: a zero says the comparison covered the same cells on both
 * sides, and only a printed zero says it.
 */
function presenceLines(result) {
	const lines = [
		`Cells: **measured ${result.cells.measured} / added ${result.cells.added.length} / removed ${result.cells.removed.length}**`
		+ `${result.cells.catalogCells == null ? '' : ` of the ${result.cells.catalogCells} the catalog declares`}`
		+ `${result.cells.catalogHash == null ? '' : ` (catalog \`${result.cells.catalogHash}\`)`}. `
		+ 'Only a cell measured on both sides has a paired ratio; a cell that executes against one build and not the other is added or removed, and is named rather than counted away.',
		'',
	]
	if (result.cells.added.length > 0) {
		lines.push(
			`> **Added.** ${nameList(result.cells.added, id => `\`${id}\``)}. These executed against the candidate build and not the baseline's, `
			+ 'so they have no before number and cannot be part of any aggregate.',
			'',
		)
	}
	if (result.cells.removed.length > 0) {
		lines.push(
			`> **Removed.** ${nameList(result.cells.removed, id => `\`${id}\``)}. These executed against the baseline build and not the candidate's. `
			+ 'A cell whose subject stopped working is a change to the library, not a gap in the measurement.',
			'',
		)
	}
	return lines
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
		...presenceLines(result),
		`A row is judged by its **95% interval**, not by its point estimate: **cleared** when the whole interval is inside ±${meaningfulThreshold}%, `
		+ `**regression** when the whole interval is at or below −${meaningfulThreshold}%, **severe** when it is a regression and the point estimate is at or below `
		+ `−${Math.abs(severeScenarioRegression)}%, and **inconclusive** when the interval spans a threshold. An inconclusive row is **not a pass** — `
		+ `it is a row this run could not judge. Paired RME is reported as a diagnostic and decides nothing.`,
		'',
		'## Benchmark-group tradeoffs',
		'',
		'| Group | Scenarios measured | Decisive | Geometric mean change |',
		'| --- | ---: | ---: | ---: |',
	]
	for (const row of result.groups) {
		lines.push(
			`| ${markdownCell(row.group)} `
			+ `| ${row.scenarios}/${row.catalogScenarios} (${coveragePercent(row.scenarios, row.catalogScenarios)}%) `
			+ `| ${row.decisiveScenarios}/${row.scenarios} `
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
				.join(', ')}. It needs at least ${minimumDecisiveScenariosPerGroup} decisive rows in a group, and these have fewer, `
				+ 'so a broad moderate regression inside one of them is watched only by the per-scenario 10% threshold.',
		)
	}

	if (result.inconclusiveScenarios.length > 0) {
		lines.push(
			'',
			`> **${result.inconclusiveScenarios.length} row${result.inconclusiveScenarios.length === 1 ? '' : 's'} this run could not judge.** `
			+ `${result.inconclusiveScenarios.slice(0, 12)
				.map(scenario => `\`${scenario}\``)
				.join(', ')}${result.inconclusiveScenarios.length > 12 ? `, and ${result.inconclusiveScenarios.length - 12} more` : ''}. `
				+ 'Their intervals span a threshold, so this run can neither clear them nor call them a change. They are **not** part of any group aggregate, '
				+ 'and they are what the retry pass re-measures: the same rows get further paired repetitions, pooled with these, and are judged once.',
		)
	}

	lines.push(
		'',
		'## Scenario changes',
		'',
		'| Scenario | Group | Issue policy | Issues | Baseline ops/s | Candidate ops/s | Change | 95% interval | Paired RME | Classification |',
		'| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
	)
	for (const row of [...result.rows].sort((left, right) => left.delta - right.delta)) {
		lines.push(`| ${markdownCell(row.scenario)} | ${markdownCell(row.group)} | ${markdownCell(row.issuePolicy)} | ${row.diagnosticIssueCount ?? 'n/a'} | ${Math.round(row.baselineOps)
			.toLocaleString('en-US')} | ${Math.round(row.candidateOps)
			.toLocaleString('en-US')} | ${formatDelta(row.delta)} | ${formatInterval(row)} | ${row.pairedRme.toFixed(2)}% | ${row.classification} |`)
	}

	lines.push(
		'',
		'## Decision rubric',
		'',
		'- Each observation is a candidate/base ratio from adjacent independent processes; the reported change is the median paired ratio.',
		'- The interval is a 95% Student’s t interval over those paired ratios, which is intentionally conservative at five process pairs.',
		'- A row is decided by whether its whole interval is on one side of a threshold, never by the point estimate alone. A point estimate past a threshold with an interval straddling it is `inconclusive`, which is what a run that cannot judge a row should say.',
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
	const groups = result.groups.map(row => `<tr><td>${htmlEscape(row.group)}</td><td>${row.scenarios}/${row.catalogScenarios} (${coveragePercent(row.scenarios, row.catalogScenarios)}%)</td><td>${row.decisiveScenarios}/${row.scenarios}</td><td>${row.delta == null ? 'n/a' : formatDelta(row.delta)}</td></tr>`)
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
	// The same presence line the Markdown report prints, and printed on the same terms:
	// always, so that a zero is visible.
	const presence = `<p>Cells: <strong>measured ${result.cells.measured} / added ${result.cells.added.length} / removed ${result.cells.removed.length}</strong>`
		+ `${result.cells.catalogCells == null ? '' : ` of the ${result.cells.catalogCells} the catalog declares`}.`
		+ `${result.cells.added.length === 0 ? '' : ` Added: ${htmlEscape(result.cells.added.join(', '))}.`}`
		+ `${result.cells.removed.length === 0 ? '' : ` Removed: ${htmlEscape(result.cells.removed.join(', '))}.`}</p>`
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Benchmark impact</title><style>:root{font-family:ui-sans-serif,system-ui,sans-serif;color:#1f2937;background:#f8fafc}body{max-width:1260px;margin:0 auto;padding:32px 20px 64px}table{border-collapse:collapse;width:100%;background:#fff;margin-bottom:28px}th,td{padding:9px 12px;border:1px solid #cbd5e1;text-align:right}th:first-child,td:first-child,th:nth-child(2),td:nth-child(2),th:nth-child(3),td:nth-child(3){text-align:left}th{background:#e2e8f0}li{line-height:1.5}</style></head><body><h1>Valchecker benchmark impact</h1><p>Verdict: <strong>${htmlEscape(result.verdict)}</strong> · Paired process runs: ${result.runCounts.baseline} · Isolation: <strong>${htmlEscape(result.measurement.isolation)}</strong> · Shards: ${result.measurement.shardCount}</p>${presence}${scope}<h2>Benchmark-group tradeoffs</h2><table><thead><tr><th>Group</th><th>Scenarios measured</th><th>Decisive rows</th><th>Change</th></tr></thead><tbody>${groups}</tbody></table><h2>Scenario changes</h2><table><thead><tr><th>Scenario</th><th>Group</th><th>Issue policy</th><th>Issues</th><th>Baseline ops/s</th><th>Candidate ops/s</th><th>Change</th><th>Paired RME</th><th>Classification</th></tr></thead><tbody>${rows}</tbody></table></body></html>\n`
}
