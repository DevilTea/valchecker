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
 * | severe | inconclusive | `unresolved` | not a pass, and not a failure |
 * | inconclusive | severe | `unresolved` | not a pass, and not a failure |
 * | severe or regression | cleared or improvement | `not-reproduced` | passes, with a noise diagnostic |
 * | inconclusive | inconclusive | `unresolved` | reported; the screen's own verdict already says the run is unsettled |
 * | severe | no confirmation measured it | `unconfirmed` or `unmeasured` | still blocks |
 *
 * Only a **severe** claim fails the build, reproduced or unconfirmed, which is the one rule
 * that failed it before this stage existed. A plain regression reproduced is a `review`, as
 * it was.
 *
 * **Groups are confirmed too, and on one runner.** A severe group verdict blocks, so it is
 * held to the same standard as a severe cell: the whole triggered group is remeasured in a
 * single-runner batch and blocks only if that batch agrees. The single runner is the point
 * rather than an economy — a cell keeps its shard across every repetition, so a
 * runner-dependent effect on its ratio is a fixed effect that shifts every `G_r` equally and
 * contributes no variance, which is why the screen's group interval can be tight and
 * displaced at once. Where the whole group does not fit one runner inside the job's budget,
 * the trigger is reported as `review` rather than blocking, and the report shows the
 * arithmetic. The confirmation's group aggregate for a group it did *not* measure in full is
 * never read: that would be an aggregate over an outcome-selected subset, which is the bias
 * `groupEstimate` was rebuilt to remove.
 */

import {
	evaluateAcceptedGroupRegressions,
	evaluateAcceptedRegressions,
	malformedAcceptedGroupRegressions,
	malformedAcceptedRegressions,
} from './accepted-regressions.mjs'
import { markdownCell, meaningfulThreshold, minimumScenariosPerGroup } from './impact-verdict.mjs'

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
export const secondsPerCellRun = 2.33
export const confirmationOverheadSeconds = 120
export const confirmationBudgetSeconds = 45 * 60

/** Whether a confirmation batch of this many cells fits one runner, and the arithmetic. */
export function confirmationBudget(cellCount, repetitions = 5) {
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
export function confirmationPlan(screen, { acknowledgedGroups = new Set(), repetitions = 5 } = {}) {
	const cellSelection = confirmationSelection(screen)
	const groups = groupsNeedingConfirmation(screen, acknowledgedGroups)
	const groupCells = (screen.rows ?? [])
		.filter(row => groups.includes(row.group))
		.map(row => ({ scenario: row.scenario, reason: 'group' }))
	const merged = new Map()
	for (const entry of [...cellSelection, ...groupCells]) {
		if (!merged.has(entry.scenario))
			merged.set(entry.scenario, entry)
	}
	const cells = [...merged.values()].sort((left, right) => (left.scenario < right.scenario ? -1 : left.scenario > right.scenario ? 1 : 0))
	const budget = confirmationBudget(cells.length, repetitions)
	const confirmsGroups = groups.length > 0 && budget.fitsOneRunner
	return {
		cells: cells.map(entry => entry.scenario),
		reasons: cells,
		/** The groups this batch can settle. Empty when the batch does not fit one runner. */
		groups: confirmsGroups ? groups : [],
		/** The groups that triggered but cannot be confirmed, so they are `review` rather than blocking. */
		unconfirmableGroups: confirmsGroups ? [] : groups,
		// One runner whenever a group is at stake, up to four otherwise: a cell's confirmation is
		// a per-cell paired ratio, which sharding does not disturb.
		shardCount: confirmsGroups ? 1 : Math.min(4, Math.max(1, cells.length)),
		budget,
	}
}

/**
 * Which cells the confirmation batch measures.
 *
 * Two kinds, and no others:
 *
 * - every candidate regression, `severe` or not. A claimed regression is what an
 *   independent reproduction is for;
 * - every `inconclusive` row whose interval reaches at or below −5%. An inconclusive row
 *   always spans *some* threshold — that is what makes it inconclusive — so the qualifier
 *   is which one: a row whose interval could still be a blocking regression is worth
 *   another batch, and one sitting between −4% and +6% is a question about an improvement
 *   nobody is gated on.
 *
 * An `improvement` and a `cleared` row are not re-measured. Neither can block, and
 * spending the batch on them would make the stage cost scale with the run rather than with
 * what is at stake. In the hosted-runner null runs this selects 6 of 170 cells in the
 * quieter run and 47 in the noisier one.
 */
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
export function resolveConfirmation(screen, confirm, { acceptedRegressions: entries, acceptedGroupRegressions: groupEntries } = {}) {
	const selection = confirmationSelection(screen)
	const confirmByScenario = new Map((confirm?.rows ?? []).map(row => [row.scenario, row]))
	// Over every measured cell, because a stale entry is one whose cell the screen *cleared*,
	// and a cleared cell is never in the confirmation selection.
	const measured = screen.rows.map(row => ({
		scenario: row.scenario,
		screen: row.classification,
		screenDelta: row.delta,
		confirm: confirmByScenario.get(row.scenario)?.classification ?? null,
		confirmDelta: confirmByScenario.get(row.scenario)?.delta ?? null,
	}))
	const malformed = entries === undefined ? malformedAcceptedRegressions() : malformedAcceptedRegressions(entries)
	const accepted = entries === undefined ? evaluateAcceptedRegressions(measured) : evaluateAcceptedRegressions(measured, entries)
	const acknowledgedCells = new Set(accepted.acknowledged.map(record => record.cell))
	// The group list, read from the screen's own group estimates. The reported group numbers are
	// untouched: a bound says how much of a true number a person has agreed to, and leaving
	// acknowledged cells out of the aggregate instead would condition it on what was previously
	// forgiven and dilute whatever lands in the group next.
	const groupMalformed = groupEntries === undefined ? malformedAcceptedGroupRegressions() : malformedAcceptedGroupRegressions(groupEntries)
	const acceptedGroups = groupEntries === undefined
		? evaluateAcceptedGroupRegressions(screen.groups ?? [])
		: evaluateAcceptedGroupRegressions(screen.groups ?? [], groupEntries)
	const acknowledgedGroups = new Set(acceptedGroups.acknowledged.map(record => record.group))
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
				// An acknowledged row keeps its two classifications and stops being a verdict input.
				// It is never dropped from the report: the row, its bound, and its reason are printed
				// where a reader of a passing gate will see them, because a gate that hides what it
				// forgave is the failure this mechanism is most likely to become.
				? 'acknowledged'
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
	const notReproduced = rows.filter(row => row.resolution === 'not-reproduced')
	const reproduced = rows.filter(row => row.resolution === 'reproduced')

	// A rotted acknowledgement list fails the build, in both directions. An entry deeper than
	// its bound is an unaccepted regression wearing an acceptance; an entry the screen has
	// cleared is a claim the code has outlived, and leaving it to be noticed later is how the
	// list stops being read at all. A malformed entry fails for the same reason.
	const listProblems = [
		...malformed,
		...groupMalformed,
		...accepted.exceeded.map(record => `${record.cell} regressed ${record.depthPercent.toFixed(2)}%, past the ${record.bound}% this repository accepts for it`),
		...accepted.stale.map(record => `the accepted regression for ${record.cell} is stale — the screen now reports it ${record.screen} at ${(record.screenDelta * 100).toFixed(2)}%, so the entry must be removed`),
		...acceptedGroups.exceeded.map(record => `the group ${record.group} regressed ${record.depthPercent.toFixed(2)}%, past the ${record.bound}% this repository accepts for it`),
		...acceptedGroups.stale.map(record => `the accepted group regression for ${record.group} is stale — the screen now reports it ${record.screen} at ${(record.screenDelta * 100).toFixed(2)}%, so the entry must be removed`),
	]

	// The groups whose trigger still stands. An acknowledged group leaves this list and is
	// reported below with its true measured value; it is not removed from the group table, and
	// the aggregate it was measured from still covers every cell.
	const unacknowledgedSevereGroups = screen.severeGroups.filter(group => !acknowledgedGroups.has(group))
	// And of those, the ones whose evidence can support blocking: a group aggregate is only
	// blocking when an independent batch measured the whole group on **one** runner and agreed.
	// A cell keeps its shard across every repetition, so a runner-dependent effect on its ratio
	// is a fixed effect that shifts each `G_r` equally and leaves the interval untouched — the
	// screen's group interval cannot see it. Everything this needs is read from the artifacts
	// rather than passed in: if the confirmation ran sharded, the group cannot block, whatever
	// the workflow intended.
	const confirmGroups = new Map((confirm?.groups ?? []).map(group => [group.group, group]))
	const confirmedCells = new Set((confirm?.rows ?? []).map(row => row.scenario))
	const singleRunnerConfirmation = confirm?.measurement?.shardCount === 1
	const groupVerdicts = unacknowledgedSevereGroups.map((group) => {
		const members = screen.rows.filter(row => row.group === group)
			.map(row => row.scenario)
		const measuredWhole = members.length > 0 && members.every(cell => confirmedCells.has(cell))
		const confirmRow = confirmGroups.get(group) ?? null
		if (confirm == null || !singleRunnerConfirmation || !measuredWhole) {
			return {
				group,
				confirmed: false,
				confirmClassification: confirmRow?.classification ?? null,
				blocking: false,
				why: confirm == null
					? 'no confirmation batch ran'
					: confirm.measurement?.shardCount == null
						? 'the confirmation comparison does not record how many shards measured it, so it cannot be read as single-runner evidence'
						: !singleRunnerConfirmation
								? `the confirmation batch ran over ${confirm.measurement.shardCount} shards, so its group aggregate mixes runners exactly as the screen's does`
								: 'the confirmation batch did not measure every cell of the group',
			}
		}
		return {
			group,
			confirmed: true,
			confirmClassification: confirmRow?.classification ?? null,
			blocking: confirmRow?.classification === 'regression',
			why: confirmRow?.classification === 'regression'
				? 'an independent single-runner batch measured the whole group and agreed'
				: `an independent single-runner batch measured the whole group and reported it ${confirmRow?.classification ?? 'not at all'}`,
		}
	})
	const blockingGroups = groupVerdicts.filter(verdict => verdict.blocking)
		.map(verdict => verdict.group)
	const reviewGroups = groupVerdicts.filter(verdict => !verdict.blocking)
		.map(verdict => verdict.group)

	const verdict = blocking.length > 0 || blockingGroups.length > 0 || listProblems.length > 0
		? 'regression'
		: unresolved.length > 0
			? 'unresolved'
			: reproduced.length > 0
				? 'review'
				// Nothing blocking survived the second batch, so the screen's own verdict stands
				// — including `inconclusive`, which stays not-a-pass, and `improvement`.
				: screen.verdict === 'regression' ? 'review' : screen.verdict

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
		/** Ways either acknowledgement list is wrong. Each one fails the gate. */
		acknowledgementProblems: listProblems,
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
		+ 'A triggered **group** is confirmed too, by remeasuring the whole group on a single runner — see the group table below — because a group '
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

	if (result.groupVerdicts.length > 0) {
		lines.push(
			'',
			`> **${result.groupVerdicts.length} group trigger${result.groupVerdicts.length === 1 ? '' : 's'} to settle.** A severe group verdict blocks, so it is held to the `
			+ 'same standard as a severe cell: the whole group is remeasured in a **single-runner** batch and blocks only if that batch agrees. One runner, '
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
				+ `${result.unresolved.length === 1 ? 'it' : 'them'}. Not a pass and not a failure, and the direction does not matter: `
				+ 'one severe judgement against one non-judgement is the same evidence whichever stage produced which. '
				+ 'Re-running until one of them settles is the thing this stage is built to avoid.',
		)
	}

	lines.push('')
	return `${lines.join('\n')}\n`
}
