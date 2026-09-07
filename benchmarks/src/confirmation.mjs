/**
 * The two-stage gate: a fixed **screen** over every selected cell, and a fixed independent
 * **confirm** batch over the rows that could block, judged on its own rather than pooled.
 *
 * What this replaces, and why. The plan of record was to re-run every `inconclusive` cell
 * for k more paired repetitions, pool them with the first pass, and judge once. That is
 * optional stopping wearing a precision target: the set being extended is chosen by the
 * first result, so the second judgement is taken on a sample that exists because the first
 * one was unsettled. Pre-declaring the rule and applying it uniformly bounds the damage but
 * does not remove it.
 *
 * Two fixed batches remove it instead. Each stage measures a fixed number of paired
 * repetitions and is judged by the rule in `impact-verdict.mjs` with no knowledge of the
 * other, and this module combines the two verdicts. Nothing is pooled, nothing is
 * re-judged, and neither stage's sample size depends on what it found.
 *
 * The combination, which is the whole decision. It is **symmetric in the two stages**: what
 * decides is how many of them judged the row and whether they agree, not which one did.
 * The first version was not, and the gate's first real run showed what that costs —
 * `set/collect-all` came back inconclusive in the screen and severe at −30.2% in the
 * confirmation batch, and was resolved as `reproduced`, while the same pair in the other
 * order (`severe` then `inconclusive`) was resolved as `unresolved`. One severe judgement
 * and one non-judgement is the same evidence either way round.
 *
 * | screen | confirm | resolution | effect |
 * | --- | --- | --- | --- |
 * | severe or regression | severe or regression | `reproduced` | fails the gate when either side is severe |
 * | severe | inconclusive | `unresolved` | not a regression verdict; a required check must not pass without an answer |
 * | inconclusive | severe | `unresolved` | not a regression verdict; a required check must not pass without an answer |
 * | severe or regression | cleared or improvement | `not-reproduced` | passes, with a noise diagnostic |
 * | inconclusive | inconclusive | `unresolved` | reported; the screen's own verdict already says the run is unsettled |
 * | severe | no confirmation measured it | `unconfirmed` or `unmeasured` | still blocks |
 *
 * Only a **severe** claim produces a regression failure, reproduced or unconfirmed, which is
 * the one product rule that failed it before this stage existed. A plain regression reproduced
 * is a `review`, as it was; an `unresolved` result is separately non-success when the caller
 * requires a resolved answer.
 *
 * **Groups are confirmed too, and on one runner.** A severe group verdict blocks, so it is
 * held to the same standard as a severe cell: the whole triggered group is remeasured in a
 * single-runner batch and blocks only if that batch agrees. The single runner is the point
 * rather than an economy — a cell keeps its shard across every repetition, so a
 * runner-dependent effect on its ratio is a fixed effect that shifts every `G_r` equally and
 * contributes no variance, which is why the screen's group interval can be tight and
 * displaced at once. Where the whole affected estimator set does not fit one runner inside the job's budget,
 * the trigger is reported as `review` rather than blocking, and the report shows the
 * arithmetic. The confirmation's group aggregate for a group it did *not* measure in full is
 * never read: that would be an aggregate over an outcome-selected subset, which is the bias
 * `groupEstimate` was rebuilt to remove.
 */

import {
	acceptedGroupRegressions as acceptedGroupRegressionEntries,
	acceptedGroupRegressionsForBase,
	acceptedRegressions as acceptedRegressionEntries,
	acceptedRegressionsForBase,
	commitHashPattern,
	evaluateAcceptedGroupRegressions,
	evaluateAcceptedRegressions,
	malformedAcceptedGroupRegressions,
	malformedAcceptedRegressions,
	matchesBaseCommit,
} from './accepted-regressions.mjs'
import { markdownCell, meaningfulThreshold, minimumScenariosPerGroup } from './impact-verdict.mjs'

export function baselineCommitOf(screen) {
	const baseline = screen?.commits?.baseline
	if (!Array.isArray(baseline) || baseline.length !== 1 || typeof baseline[0] !== 'string')
		return null
	const commit = baseline[0]
	return commitHashPattern.test(commit) ? commit : null
}

/**
 * What one paired cell-measurement costs, and how much of a job may be spent on the
 * confirmation batch. Both are measured rather than guessed, so the fallback below is forced
 * by arithmetic instead of chosen for convenience.
 *
 * From run 30547023911: each screen shard measured 245/4 ≈ 61 cells × 5 repetitions × 2 sides
 * = 613 cell-runs in an average of 1429 s, which is **2.33 s per cell-run**, so a confirmation
 * batch of N cells costs 23.3·N seconds. The job's overhead — checkout, setup, installing and
 * building both revisions — measured about 40 s in the same workflow, and 120 s here leaves
 * room for a slow install.
 *
 * The budget is 45 of the job's 60 minutes. The remaining quarter is deliberate: a hosted
 * runner that happens to be slower than the one these figures came from must not turn a
 * blocking decision into a timeout, which reads as infrastructure failure rather than as a
 * verdict.
 */
const byScenario = (left, right) => (left.scenario < right.scenario ? -1 : left.scenario > right.scenario ? 1 : 0)

export const secondsPerCellRun = 2.33
export const confirmationOverheadSeconds = 120
export const confirmationBudgetSeconds = 45 * 60

/** Whether a confirmation batch of this many cells fits one runner, and the arithmetic. */
export function confirmationBudget(cellCount, repetitions = 5) {
	// `repetitions` is the count the run actually used. Pricing a batch at a default while the
	// workflow executes a dispatched `runs` would admit a job nobody scheduled.

	const measurementSeconds = cellCount * repetitions * 2 * secondsPerCellRun
	const totalSeconds = measurementSeconds + confirmationOverheadSeconds
	return {
		cells: cellCount,
		measurementSeconds,
		totalSeconds,
		budgetSeconds: confirmationBudgetSeconds,
		fitsOneRunner: totalSeconds <= confirmationBudgetSeconds,
	}
}

/**
 * The groups whose screen trigger needs an independent confirmation before it may block, and
 * the cells that confirmation has to measure.
 *
 * **Why a group needs one at all, and why on a single runner.** A cell keeps its shard for all
 * five repetitions, so a runner- or microarchitecture-dependent effect on that cell's
 * candidate/base *ratio* is a fixed effect across `r`: it shifts every `G_r` by the same
 * amount and contributes no variance. The Student-t interval across repetitions therefore
 * cannot widen for it — the group estimate can be tight and still be displaced by which
 * runners the shards drew. That is bias, not noise, and the earlier claim in this repository
 * that the runner difference "cannot inflate the spread" was the reason to worry rather than a
 * reassurance. It is not hypothetical: in run 30547023911 screen shard 2 ran on an AMD EPYC
 * 9V74 while shards 0, 1 and 3 ran on AMD EPYC 7763.
 *
 * A severe *group* verdict blocks and, unlike a severe cell, was not independently confirmed.
 * So a triggered group is remeasured in full on one runner, which makes its confirmation
 * aggregate a single-machine estimate and gives the group the same standard a cell already
 * has: two measurements, two independent runner draws, both saying severe.
 */
export function groupsNeedingConfirmation(screen, acknowledgedGroups = new Set()) {
	return (screen.groups ?? [])
		.filter(group => group.classification === 'regression'
			&& group.scenarios >= minimumScenariosPerGroup
			&& !acknowledgedGroups.has(group.group))
		.map(group => group.group)
}

/**
 * The confirmation batch as a plan: which cells, over how many shards, and for which groups
 * the result can support a blocking verdict.
 *
 * The shard count is 1 whenever a group is being confirmed, because a group aggregate mixed
 * across runners is the thing being corrected — confirming it on four machines would reproduce
 * the defect. When the batch does not fit one runner, the plan says so and the groups fall back
 * to `review`: a cross-shard hosted-runner group regression is then reported as evidence that
 * cannot support blocking, rather than blocking on it anyway.
 */
export function confirmationPlan(screen, { acknowledgedGroups, acknowledgedCells, repetitions = 5 } = {}) {
	const baseCommit = baselineCommitOf(screen)
	const resolvedAcknowledgedGroups = acknowledgedGroups ?? new Set(acceptedGroupRegressionsForBase(baseCommit)
		.map(entry => entry.group))
	const resolvedAcknowledgedCells = acknowledgedCells ?? new Set(acceptedRegressionsForBase(baseCommit)
		.map(entry => entry.cell))
	// Rows and groups are scheduled **independently**, and that is the whole shape of this
	// function. They used to share one budget over the union of everything the second stage
	// asked, and `confirmsGroups` was all-or-nothing over it — so a group that fitted a single
	// runner comfortably by itself was downgraded to `review` because unrelated boundary rows
	// also needed confirming, and two groups that each fitted alone but not together left
	// neither able to block. The one trigger built to catch a broad moderate regression was
	// coupled to unrelated noise elsewhere in the run, and the rot-check workload consumed the
	// same budget although it must not decide whether a new severe group gets valid evidence.
	//
	// So each group gets its own single-runner batch, sized by the cells required to establish
	// *that group's* claim and nothing else, and the ordinary rows keep their sharded batch.
	const rowCells = [
		...confirmationSelection(screen),
		// Acknowledged cells ride with the rows: they are a rot-check workload, they do not need a
		// single runner, and they must not enter any group's budget.
		...(screen.rows ?? []).filter(row => resolvedAcknowledgedCells.has(row.scenario))
			.map(row => ({ scenario: row.scenario, reason: 'acknowledged' })),
	]
	const mergedRows = new Map()
	for (const entry of rowCells) {
		if (!mergedRows.has(entry.scenario))
			mergedRows.set(entry.scenario, entry)
	}
	const rows = [...mergedRows.values()].sort(byScenario)

	// Triggered groups need confirmation before they can block; acknowledged groups need it so
	// their entries stay falsifiable. Both are judged on their own cells.
	const groupNames = [...new Set([
		...groupsNeedingConfirmation(screen, resolvedAcknowledgedGroups),
		...(screen.groups ?? []).filter(group => resolvedAcknowledgedGroups.has(group.group))
			.map(group => group.group),
	])]
	const groups = groupNames.map((group) => {
		const cells = (screen.rows ?? []).filter(row => row.group === group && (row.measurementRole ?? 'affected') === 'affected')
			.map(row => row.scenario)
			.sort()
		const budget = confirmationBudget(cells.length, repetitions)
		return { group, cells, budget, fits: budget.fitsOneRunner }
	})

	const rowBudget = confirmationBudget(rows.length, repetitions)
	const batches = [
		...Array.from({ length: rows.length === 0 ? 0 : Math.min(4, rows.length) }, (unused, shard) => ({
			id: `rows-${shard}`,
			kind: 'rows',
			group: null,
			cells: rows.map(entry => entry.scenario),
			shardIndex: shard,
			shardCount: Math.min(4, rows.length),
		})),
		...groups.filter(entry => entry.fits && entry.cells.length > 0)
			.map(entry => ({
				id: `group-${entry.group.replaceAll('/', '-')}`,
				kind: 'group',
				group: entry.group,
				cells: entry.cells,
				shardIndex: 0,
				// One runner, always: a group aggregate mixed across runners is the defect being
				// corrected, so confirming it on four machines would reproduce it.
				shardCount: 1,
			})),
	]

	return {
		batches,
		/** Every cell the second stage measures, across all batches. Reported, never a budget. */
		cells: [...new Set(batches.flatMap(batch => batch.cells))].sort(),
		reasons: rows,
		/** The groups a batch will settle, each admitted on its own cost. */
		groups: groups.filter(entry => entry.fits)
			.map(entry => entry.group),
		/**
		 * The groups no single runner can settle within the budget. A triggered one becomes
		 * `review` instead of blocking; an acknowledged one has its rot check reported unassessed,
		 * which is also the signal that a bounded acknowledgement is the wrong instrument for a
		 * group that large on this hardware.
		 */
		unconfirmableGroups: groups.filter(entry => !entry.fits)
			.map(entry => entry.group),
		/** Per-group arithmetic, so a `review` can be read rather than trusted. */
		groupBudgets: groups.map(entry => ({ group: entry.group, cells: entry.cells.length, ...entry.budget })),
		rowBudget,
	}
}

/**
 * The plan as a person reads it, kept here rather than in the CLI.
 *
 * It lived in `resolve-confirmation.mjs` and went stale the moment `confirmationPlan` changed
 * shape: it still read `plan.budget.totalSeconds` and `plan.shardCount`, both of which had been
 * replaced by per-batch and per-group figures, so the compare job died with a `TypeError` on an
 * undefined field and the confirmation stage never ran. Formatting the plan is logic about the
 * plan, so it belongs where the plan is defined and where a test fails on it — a thin CLI is the
 * point of the split, and this was not thin.
 */
export function planSummaryLines(plan) {
	const lines = []
	if (plan.batches.length === 0) {
		lines.push('[confirm] nothing to confirm: no row claimed a regression, came within the decision boundary, or belongs to a group being settled')
		return lines
	}
	const rowBatches = plan.batches.filter(batch => batch.kind === 'rows')
	if (rowBatches.length > 0) {
		lines.push(`[confirm] rows: ${rowBatches[0].cells.length} cell(s) over ${rowBatches.length} shard(s), `
			+ `${plan.rowBudget.totalSeconds.toFixed(0)}s of measurement`)
	}
	for (const batch of plan.batches.filter(candidate => candidate.kind === 'group')) {
		const budget = plan.groupBudgets.find(entry => entry.group === batch.group)
		lines.push(`[confirm] group ${batch.group}: ${batch.cells.length} cell(s) on one runner`
			+ `${budget == null ? '' : `, ${(budget.totalSeconds / 60).toFixed(1)} min of a ${(budget.budgetSeconds / 60).toFixed(0)} min budget`}`)
	}
	for (const group of plan.unconfirmableGroups) {
		const budget = plan.groupBudgets.find(entry => entry.group === group)
		lines.push(`[confirm] group ${group} cannot be confirmed on one runner`
			+ `${budget == null ? '' : ` (${budget.cells} cells need ${(budget.totalSeconds / 60).toFixed(1)} min against a ${(budget.budgetSeconds / 60).toFixed(0)} min budget)`}`
			+ ' — it is review, not blocking')
	}
	return lines
}

export function confirmationSelection(screen) {
	const boundary = -meaningfulThreshold / 100
	return screen.rows
		.filter(row => row.classification === 'severe' || row.classification === 'regression'
			|| (row.classification === 'inconclusive' && row.intervalLow <= boundary))
		.map(row => ({
			scenario: row.scenario,
			reason: row.classification === 'inconclusive' ? 'boundary' : row.classification,
		}))
		.sort((left, right) => (left.scenario < right.scenario ? -1 : left.scenario > right.scenario ? 1 : 0))
}

const claimsRegression = classification => classification === 'severe' || classification === 'regression'

/**
 * One row's resolution, from both classifications rather than the confirmation's alone.
 *
 * Symmetric on purpose: `reproduced` means both stages judged it a regression, and
 * `unresolved` means one of them could not judge — in either direction. Reading only the
 * confirmation batch made the pair (severe, inconclusive) resolve two different ways
 * depending on which stage was which, and the gate's first real run produced exactly that
 * pair in both orders.
 */
function resolutionOf(screenClassification, confirmClassification) {
	if (confirmClassification == null)
		return 'unmeasured'
	if (claimsRegression(confirmClassification))
		return claimsRegression(screenClassification) ? 'reproduced' : 'unresolved'
	if (confirmClassification === 'inconclusive')
		return 'unresolved'
	return 'not-reproduced'
}

/**
 * The final verdict: the screen's, corrected by what the confirmation batch found.
 *
 * `confirm` is `null` when no cell needed confirming, which is the common case on a clean
 * pull request and is not the same as a confirmation that found nothing — the report says
 * which.
 */
export function resolveConfirmation(screen, confirm, { acceptedRegressions: entries, acceptedGroupRegressions: groupEntries, groupConfirmations = {} } = {}) {
	const selection = confirmationSelection(screen)
	const confirmByScenario = new Map((confirm?.rows ?? []).map(row => [row.scenario, row]))
	// Over every measured cell, because a stale entry is one whose cell the screen *cleared*,
	// and a cleared cell is never in the confirmation selection.
	const measured = screen.rows.map((row) => {
		const confirmRow = confirmByScenario.get(row.scenario) ?? null
		return {
			scenario: row.scenario,
			screen: row.classification,
			screenDelta: row.delta,
			// Intervals, because a bound is a decision threshold and gets the same interval
			// semantics as every other threshold in this gate.
			screenLow: row.intervalLow,
			screenHigh: row.intervalHigh,
			confirm: confirmRow?.classification ?? null,
			confirmDelta: confirmRow?.delta ?? null,
			confirmLow: confirmRow?.intervalLow ?? null,
			confirmHigh: confirmRow?.intervalHigh ?? null,
		}
	})
	const baseCommit = baselineCommitOf(screen)
	const malformed = entries === undefined ? malformedAcceptedRegressions() : malformedAcceptedRegressions(entries)
	const accepted = entries === undefined
		? evaluateAcceptedRegressions(measured, acceptedRegressionEntries, baseCommit)
		: evaluateAcceptedRegressions(measured, entries, baseCommit)
	// **Acceptance state is separate from ordinary regression state.** A cell with an entry is
	// exempt from the ordinary row rules whatever its bound turned out to say, and only the
	// acceptance list itself can fail on it — a reproduced breach, a stale entry, a malformed one.
	//
	// It used to be exempt only when the bound came out `within`, which put the P1-c pattern back
	// in a new place: an acknowledgement raises the threshold from 5% to the bound, so falling back
	// to the ordinary threshold when the bound could not be assessed applied a *stricter* rule than
	// the acknowledgement would have, and having the entry was worse than not having it. Concretely
	// with a 45% bound: a screen `severe` at [−60%, −20%] spans the bound, a confirmation `severe`
	// at [−35%, −25%] is wholly inside it, no breach is reproduced, so the bound is `unassessed` —
	// and the cell then resolved as an ordinary reproduced severe row and turned the gate red,
	// although neither stage established that the 45% ceiling was breached.
	const failedAcceptanceCells = new Set([
		...accepted.exceeded.map(record => record.cell),
		...accepted.stale.map(record => record.cell),
	])
	const activeCellEntries = (entries === undefined ? acceptedRegressionEntries : entries)
		.filter(entry => matchesBaseCommit(entry.baseCommit, baseCommit))
	const acceptedCellNames = new Set(activeCellEntries.map(entry => entry.cell))
	const acknowledgedCells = new Set([...acceptedCellNames].filter(cell => !failedAcceptanceCells.has(cell)))
	const withinBoundCells = new Set(accepted.acknowledged.map(record => record.cell))
	// The group list, read from the screen's own group estimates. The reported group numbers are
	// untouched: a bound says how much of a true number a person has agreed to, and leaving
	// acknowledged cells out of the aggregate instead would condition it on what was previously
	// forgiven and dilute whatever lands in the group next.
	const groupMalformed = groupEntries === undefined ? malformedAcceptedGroupRegressions() : malformedAcceptedGroupRegressions(groupEntries)
	// Every judgement about an acknowledged group reads the single-runner confirmation, never the
	// cross-shard screen: retiring an entry is as consequential as blocking on one, and the screen
	// is the instrument that reported this group `regression` and `cleared` two runs apart.
	// Each group's evidence is **its own** single-runner batch, not the row confirmation. The two
	// are scheduled independently, so a group's claim never depends on how much unrelated work the
	// second stage happened to have.
	const groupEvidence = (group) => {
		const comparison = groupConfirmations[group] ?? null
		const members = (screen.rows ?? []).filter(row => row.group === group && (row.measurementRole ?? 'affected') === 'affected')
			.map(row => row.scenario)
		const measured = new Set((comparison?.rows ?? []).map(row => row.scenario))
		return {
			comparison,
			row: (comparison?.groups ?? []).find(entry => entry.group === group) ?? null,
			singleRunner: comparison?.measurement?.shardCount === 1,
			measuredWhole: members.length > 0 && members.every(cell => measured.has(cell)),
		}
	}
	const confirmationContext = {
		groups: Object.values(groupConfirmations)
			.flatMap(comparison => comparison?.groups ?? []),
		singleRunner: true,
		measuredWhole: group => groupEvidence(group).singleRunner && groupEvidence(group).measuredWhole,
	}
	const acceptedGroups = groupEntries === undefined
		? evaluateAcceptedGroupRegressions(screen.groups ?? [], confirmationContext, acceptedGroupRegressionEntries, baseCommit)
		: evaluateAcceptedGroupRegressions(screen.groups ?? [], confirmationContext, groupEntries, baseCommit)
	const acknowledgedGroups = new Set(acceptedGroups.acknowledged.map(record => record.group))
	void acknowledgedGroups
	const rows = selection.map(({ scenario, reason }) => {
		const screenRow = screen.rows.find(row => row.scenario === scenario)
		const confirmRow = confirmByScenario.get(scenario) ?? null
		return {
			scenario,
			reason,
			screen: screenRow.classification,
			screenDelta: screenRow.delta,
			confirm: confirmRow?.classification ?? null,
			confirmDelta: confirmRow?.delta ?? null,
			resolution: acknowledgedCells.has(scenario)
				// An accepted row keeps its two classifications and stops being a verdict input. It
				// is never dropped from the report: the row, its bound, and its reason are printed
				// where a reader of a passing gate will see them, because a gate that hides what it
				// forgave is the failure this mechanism is most likely to become. `acknowledged`
				// means the bound was judged and held; `acceptance-unassessed` means it could not be
				// judged, which is review — never the ordinary threshold applied instead.
				? (withinBoundCells.has(scenario) ? 'acknowledged' : 'acceptance-unassessed')
				: confirm == null ? 'unconfirmed' : resolutionOf(screenRow.classification, confirmRow?.classification),
		}
	})

	// Only a **severe** claim can fail the build, which is the one rule that failed it before
	// this stage existed; a reproduced plain regression is a review, as it was. A severe claim
	// blocks when the other stage reproduced it or when no confirmation measured it, and it
	// leaves the run unresolved when the other stage could not judge — whichever stage made
	// the claim, since one severe judgement and one non-judgement is the same evidence either
	// way round.
	const severeClaims = rows.filter(row => row.screen === 'severe' || row.confirm === 'severe')
	const blocking = severeClaims.filter(row => row.resolution === 'reproduced' || row.resolution === 'unconfirmed')
	const unresolved = severeClaims.filter(row => row.resolution === 'unresolved' || row.resolution === 'unmeasured')
	const boundaryUnresolved = rows.filter(row => !severeClaims.includes(row) && (row.resolution === 'unresolved' || row.resolution === 'unmeasured'))
	const notReproduced = rows.filter(row => row.resolution === 'not-reproduced')
	const reproduced = rows.filter(row => row.resolution === 'reproduced')

	// A rotted acknowledgement list fails the build, in both directions. An entry deeper than
	// its bound is an unaccepted regression wearing an acceptance; an entry the screen has
	// cleared is a claim the code has outlived, and leaving it to be noticed later is how the
	// list stops being read at all. A malformed entry fails for the same reason.
	const listProblems = [
		...malformed,
		...groupMalformed,
		...accepted.exceeded.map(record => `${record.cell} breached its ${record.bound}% bound (deepest estimate ${record.depthPercent.toFixed(2)}%) — ${record.why}`),
		...accepted.stale.map(record => `the accepted regression for ${record.cell} is stale — the screen now reports it ${record.screen} at ${(record.screenDelta * 100).toFixed(2)}%, so the entry must be removed`),
		...acceptedGroups.exceeded.map(record => `the group ${record.group} breached its ${record.bound}% bound (deepest estimate ${record.depthPercent.toFixed(2)}%) — ${record.why}`),
		...acceptedGroups.stale.map(record => `the accepted group regression for ${record.group} is stale — an independent single-runner batch reports it ${record.screen} at ${(record.screenDelta * 100).toFixed(2)}%, so the entry must be removed`),
	]
	// Reported, and deliberately not a failure. A rot check with no evidence behind it must not
	// fail the gate — that is the unsatisfiable gate this rule exists to remove — and must not
	// read as a pass either, which is why it is named in the report.
	const unassessedAcknowledgements = [
		...accepted.unassessed.map(record => `${record.cell}: ${record.why}`),
		...acceptedGroups.unassessed.map(record => `${record.group}: ${record.why}`),
	]

	// The groups whose trigger still stands. An acknowledged group leaves this list and is
	// reported below with its true measured value; it is not removed from the group table, and
	// the aggregate it was measured from still covers every cell.
	const failedAcceptanceGroups = new Set([
		...acceptedGroups.exceeded.map(record => record.group),
		...acceptedGroups.stale.map(record => record.group),
	])
	const activeGroupEntries = (groupEntries === undefined ? acceptedGroupRegressionEntries : groupEntries)
		.filter(entry => matchesBaseCommit(entry.baseCommit, baseCommit))
	const acceptedGroupNames = new Set(activeGroupEntries.map(entry => entry.group))
	// Exempt because an entry exists, not because the bound came out `within`. A cross-shard screen
	// spanning the group bound while the trusted single-runner confirmation is wholly inside it
	// left the group unassessed and then blocked it on the ordinary 5% trigger — the stricter rule
	// again, applied precisely where the acceptance was supposed to relax it.
	const unacknowledgedSevereGroups = screen.severeGroups
		.filter(group => !acceptedGroupNames.has(group) || failedAcceptanceGroups.has(group))
	// And of those, the ones whose evidence can support blocking: a group aggregate is only
	// blocking when an independent batch measured the whole affected estimator set on **one** runner and agreed.
	// A cell keeps its shard across every repetition, so a runner-dependent effect on its ratio
	// is a fixed effect that shifts each `G_r` equally and leaves the interval untouched — the
	// screen's group interval cannot see it. Everything this needs is read from the artifacts
	// rather than passed in: if the confirmation ran sharded, the group cannot block, whatever
	// the workflow intended.
	const groupVerdicts = unacknowledgedSevereGroups.map((group) => {
		const evidence = groupEvidence(group)
		if (evidence.comparison == null || !evidence.singleRunner || !evidence.measuredWhole) {
			return {
				group,
				confirmed: false,
				confirmClassification: evidence.row?.classification ?? null,
				blocking: false,
				why: evidence.comparison == null
					? 'no single-runner batch measured this group, so its trigger rests on a cross-shard aggregate whose interval cannot see a between-runner shift'
					: evidence.comparison.measurement?.shardCount == null
						? 'its confirmation does not record how many shards measured it, so it cannot be read as single-runner evidence'
						: !evidence.singleRunner
								? `its confirmation ran over ${evidence.comparison.measurement.shardCount} shards, so that aggregate mixes runners exactly as the screen's does`
								: 'its confirmation did not measure every affected cell of the group',
			}
		}
		return {
			group,
			confirmed: true,
			confirmClassification: evidence.row?.classification ?? null,
			blocking: evidence.row?.classification === 'regression',
			why: evidence.row?.classification === 'regression'
				? 'an independent single-runner batch measured the whole affected estimator set and agreed'
				: `an independent single-runner batch measured the whole affected estimator set and reported it ${evidence.row?.classification ?? 'not at all'}`,
		}
	})
	const blockingGroups = groupVerdicts.filter(verdict => verdict.blocking)
		.map(verdict => verdict.group)
	const reviewGroups = groupVerdicts.filter(verdict => !verdict.blocking)
		.map(verdict => verdict.group)

	let verdict = screen.verdict
	if (blocking.length > 0 || blockingGroups.length > 0 || listProblems.length > 0)
		verdict = 'regression'
	else if (unresolved.length > 0)
		verdict = 'unresolved'
	else if (reproduced.length > 0)
		verdict = 'review'
	else if (screen.verdict === 'regression' || screen.verdict === 'inconclusive' || boundaryUnresolved.length > 0)
		verdict = 'review'

	return {
		schemaVersion: 1,
		verdict,
		screenVerdict: screen.verdict,
		confirmed: confirm != null,
		// Read from the comparisons rather than declared here. Both stages are meant to be
		// five paired repetitions and the workflow is what sets that; a constant in this file
		// would be a second copy of the number, and a report is worth more when it says what
		// was measured than when it repeats what was intended.
		repetitions: { screen: screen.runCounts?.baseline ?? null, confirm: confirm?.runCounts?.baseline ?? null },
		/**
		 * The screen stage's group trigger as measured, carried through unchanged: it is not
		 * confirmed here, and an acknowledged group is still named in it.
		 */
		severeGroups: screen.severeGroups,
		/** The measured list minus the acknowledged groups: triggers that still stand. */
		unacknowledgedSevereGroups,
		/** Of those, the ones an independent single-runner batch reproduced. Only these block. */
		blockingGroups,
		/** The rest: reported for review, because their evidence cannot support blocking. */
		reviewGroups,
		/** Why each standing trigger did or did not become blocking. */
		groupVerdicts,
		rows,
		blocking: blocking.map(row => row.scenario),
		unresolved: unresolved.map(row => row.scenario),
		boundaryUnresolved: boundaryUnresolved.map(row => row.scenario),
		reproduced: reproduced.map(row => row.scenario),
		/** Rows the second batch did not reproduce: the screen's own noise, measured. */
		notReproduced: notReproduced.map(row => row.scenario),
		/**
		 * The regressions this repository has decided to accept, as measured in this run, with
		 * the bound each is accepted within and the reason it was. Always reported, never a
		 * silent pass.
		 */
		acknowledged: accepted.acknowledged,
		/** The same, at group level: the true measured aggregate and the bound it is within. */
		acknowledgedGroups: acceptedGroups.acknowledged,
		/** Historical entries inactive for this baseline commit. */
		inactiveAcknowledgements: [
			...accepted.inactive.map(record => ({ type: 'cell', ...record })),
			...acceptedGroups.inactive.map(record => ({ type: 'group', ...record })),
		],
		/** Ways either acknowledgement list is wrong. Each one fails the gate. */
		acknowledgementProblems: listProblems,
		/** Rot checks this run had no evidence to perform. Reported, never a pass, never a failure. */
		unassessedAcknowledgements,
	}
}

export function renderConfirmationMarkdown(result) {
	const lines = [
		'## Confirmation stage',
		'',
		`Verdict: **${result.verdict}** · screen verdict: **${result.screenVerdict}** · `
		+ `${result.repetitions.screen ?? '?'} screening `
		+ `${result.repetitions.confirm == null ? 'and no confirming' : `+ ${result.repetitions.confirm} confirming`} paired repetitions.`,
		'',
		'Two fixed batches, judged independently. The confirmation batch is a second measurement of the rows that could block — '
		+ 'every candidate regression, and every inconclusive row whose interval reaches −5% — and it is **not** pooled with the first: '
		+ 'adding samples to a set chosen by the first result until the interval settles is optional stopping, whatever the stopping rule is called. '
		+ 'A triggered **group** is confirmed too, by remeasuring the whole affected estimator set on a single runner — see the group table below — because a group '
		+ 'aggregate mixed across runners carries a between-runner shift its interval cannot see.',
		'',
	]

	// No early return here, whatever the row table holds. A run can have no cell to confirm and
	// still have a group trigger to settle or an accepted regression to declare, and returning
	// before those sections is how a report ends up silent about the thing that decided it.
	if (result.rows.length === 0)
		lines.push('No row claimed a regression or came within the decision boundary, so there was no cell to confirm.', '')

	if (result.rows.length > 0 && !result.confirmed) {
		lines.push(`> **Not confirmed.** ${result.rows.length} row${result.rows.length === 1 ? '' : 's'} needed a second batch and none ran, `
			+ 'so every one of them is reported as `unconfirmed` and a severe row among them still blocks.', '')
	}

	if (result.rows.length > 0) {
		lines.push(
			'| Cell | Selected because | Screen | Confirm | Resolution |',
			'| --- | --- | ---: | ---: | --- |',
		)
	}
	for (const row of result.rows) {
		lines.push(
			`| \`${row.scenario}\` | ${row.reason} | ${row.screen} (${(row.screenDelta * 100).toFixed(1)}%) `
			+ `| ${row.confirm == null ? 'n/a' : `${row.confirm} (${(row.confirmDelta * 100).toFixed(1)}%)`} | ${row.resolution} |`,
		)
	}

	if (result.notReproduced.length > 0) {
		lines.push(
			'',
			`> **Noise diagnostic.** ${result.notReproduced.map(scenario => `\`${scenario}\``)
				.join(', ')} claimed a regression in the screen and came back clear in an independent batch. `
				+ 'That is the screen\'s own false-positive rate being measured rather than argued, and it is worth tracking across runs.',
		)
	}

	if (result.boundaryUnresolved?.length > 0) {
		lines.push(
			'',
			`> **Boundary uncertainty.** ${result.boundaryUnresolved.map(scenario => `\`${scenario}\``)
				.join(', ')}: ordinary ±5% boundary rows that could not be settled decisively by both batches. `
				+ 'Because neither batch measured a severe regression, these rows do not block the gate and are reported as noise diagnostics.',
		)
	}

	if (result.acknowledged.length > 0) {
		lines.push(
			'',
			`> **${result.acknowledged.length} accepted regression${result.acknowledged.length === 1 ? '' : 's'}**, listed rather than forgiven in silence. `
			+ 'Each is an entry in `benchmarks/src/accepted-regressions.mjs` naming the cell, the depth accepted, and what the cost bought; '
			+ 'a measurement past the bound fails, and an entry the screen has cleared fails too, so the list shrinks as the code improves. '
			+ 'It cannot tell an accepted cost from a regression someone got tired of — the reason is the argument, and review reads it.',
			'',
			'| Cell | Measured | Accepted to | Because |',
			'| --- | ---: | ---: | --- |',
		)
		for (const record of result.acknowledged)
			lines.push(`| \`${record.cell}\` | −${record.depthPercent.toFixed(2)}% | −${record.bound}% | ${markdownCell(record.because)} |`)
	}

	if (result.inactiveAcknowledgements?.length > 0) {
		lines.push(
			'',
			`> **${result.inactiveAcknowledgements.length} inactive historical acknowledgement${result.inactiveAcknowledgements.length === 1 ? '' : 's'}.** `
			+ 'Pinned to a different baseline commit and not applied to this comparison. They neither exempt regressions nor trigger rot checks.',
			'',
			'| Type | Target | Base commit | Bound | Because |',
			'| --- | --- | --- | ---: | --- |',
		)
		for (const record of result.inactiveAcknowledgements) {
			const target = record.type === 'cell' ? `\`${record.cell}\`` : `group \`${record.group}\``
			const shortBase = record.baseCommit ? `\`${record.baseCommit.slice(0, 7)}\`` : 'n/a'
			lines.push(`| ${record.type} | ${target} | ${shortBase} | −${record.bound}% | ${markdownCell(record.because)} |`)
		}
	}

	if (result.groupVerdicts.length > 0) {
		lines.push(
			'',
			`> **${result.groupVerdicts.length} group trigger${result.groupVerdicts.length === 1 ? '' : 's'} to settle.** A severe group verdict blocks, so it is held to the `
			+ 'same standard as a severe cell: the whole affected estimator set is remeasured in a **single-runner** batch and blocks only if that batch agrees. One runner, '
			+ 'because a cell keeps its shard across every repetition — a runner-dependent effect on its ratio is a fixed effect that shifts every `G_r` '
			+ 'equally and contributes no variance, so the screen\'s group interval can be tight and displaced at the same time. Where the group does not '
			+ 'fit one runner inside the job\'s budget, the trigger is `review` rather than blocking.',
			'',
			'| Group | Blocking | Confirmation | Why |',
			'| --- | --- | --- | --- |',
		)
		for (const verdict of result.groupVerdicts)
			lines.push(`| \`${verdict.group}\` | ${verdict.blocking ? 'yes' : 'no'} | ${verdict.confirmClassification ?? 'not measured'} | ${markdownCell(verdict.why)} |`)
	}

	if (result.acknowledgedGroups.length > 0) {
		lines.push(
			'',
			`> **${result.acknowledgedGroups.length} accepted group regression${result.acknowledgedGroups.length === 1 ? '' : 's'}.** `
			+ 'A group aggregate is accepted by an entry naming the group, never by a cell acknowledgement reaching further, and never by '
			+ 'leaving acknowledged cells out of the aggregate — that would condition the estimate on what was previously forgiven and dilute '
			+ 'whatever lands in the group next. The value below is the true one, over every cell in the group.',
			'',
			'| Group | Measured | Accepted to | Because |',
			'| --- | ---: | ---: | --- |',
		)
		for (const record of result.acknowledgedGroups)
			lines.push(`| \`${record.group}\` | −${record.depthPercent.toFixed(2)}% | −${record.bound}% | ${markdownCell(record.because)} |`)
	}

	if (result.unassessedAcknowledgements.length > 0) {
		lines.push(
			'',
			`> **${result.unassessedAcknowledgements.length} rot check${result.unassessedAcknowledgements.length === 1 ? '' : 's'} this run could not perform.** `
			+ `${result.unassessedAcknowledgements.map(problem => `\`${problem}\``)
				.join(' ')} Retiring an acknowledgement is as consequential as blocking on one, so it needs the same evidence: `
				+ 'both measurements agreeing for a cell, and a single-runner batch for a group. Neither a pass nor a failure — an unassessed check that '
				+ 'read as "checked and fine" is the failure mode this list exists to avoid.',
		)
	}

	if (result.acknowledgementProblems.length > 0) {
		lines.push(
			'',
			'> **The accepted-regression list is wrong.** '
			+ `${result.acknowledgementProblems.map(problem => `${problem}.`)
				.join(' ')} Each of these fails the gate: an acknowledgement is a claim, and a claim the measurements contradict is worse than no claim.`,
		)
	}

	if (result.blocking.length > 0) {
		lines.push(
			'',
			`> **Blocking.** ${result.blocking.map(scenario => `\`${scenario}\``)
				.join(', ')}: a severe regression claimed by one batch and reproduced by a second, independent one — `
				+ 'or claimed and never confirmed, which is not a clearing. This is what fails the gate.',
		)
	}

	if (result.unresolved.length > 0) {
		lines.push(
			'',
			`> **Unresolved.** ${result.unresolved.map(scenario => `\`${scenario}\``)
				.join(', ')}: one batch calls ${result.unresolved.length === 1 ? 'it' : 'them'} a severe regression and the other cannot judge `
				+ `${result.unresolved.length === 1 ? 'it' : 'them'}. This is not relabelled a regression, but a required check must not pass without an answer; the direction does not matter: `
				+ 'one severe judgement against one non-judgement is the same evidence whichever stage produced which. '
				+ 'Re-running until one of them settles is the thing this stage is built to avoid.',
		)
	}

	lines.push('')
	return `${lines.join('\n')}\n`
}
