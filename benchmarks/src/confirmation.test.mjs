import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
	confirmationBudget,
	confirmationBudgetSeconds,
	confirmationPlan,
	confirmationSelection,
	renderConfirmationMarkdown,
	resolveConfirmation,
	secondsPerCellRun,
} from './confirmation.mjs'

/**
 * The two-stage decision, driven by the combinations the review's table names and by the
 * ones it does not — an unmeasured row, a confirmation that never ran, and a group trigger
 * that this stage deliberately does not confirm.
 *
 * The fixtures are the shape `compareResults` returns, written by hand and cut down to the
 * fields this module reads. Driving it through two real comparisons would make each case a
 * question about `ratiosWith` rather than about the rule under test.
 */

function screenOf(rows, { verdict = 'review', severeGroups = [] } = {}) {
	return {
		verdict,
		severeGroups,
		runCounts: { baseline: 5, candidate: 5 },
		rows: rows.map(([scenario, classification, delta, intervalLow = delta]) => ({
			scenario,
			classification,
			delta,
			intervalLow,
		})),
	}
}

function confirmOf(rows) {
	return {
		runCounts: { baseline: 5, candidate: 5 },
		rows: rows.map(([scenario, classification, delta]) => ({ scenario, classification, delta })),
	}
}

test('the report states the repetitions each stage measured, not the ones it intended', () => {
	// Read from the two comparisons. A constant here would be a second copy of a number the
	// workflow sets, and it would keep printing 5 on a dispatched run that asked for 7.
	const screen = screenOf([['a', 'severe', -0.14, -0.2]], { verdict: 'regression' })
	screen.runCounts = { baseline: 7, candidate: 7 }
	const confirmed = resolveConfirmation(screen, confirmOf([['a', 'cleared', 0]]))
	assert.deepEqual(confirmed.repetitions, { screen: 7, confirm: 5 })
	assert.match(renderConfirmationMarkdown(confirmed), /7 screening \+ 5 confirming paired repetitions/)

	const unconfirmed = resolveConfirmation(screen, null)
	assert.deepEqual(unconfirmed.repetitions, { screen: 7, confirm: null })
	assert.match(renderConfirmationMarkdown(unconfirmed), /7 screening and no confirming paired repetitions/)
})

test('the confirmation batch measures the rows that could block, and nothing else', () => {
	const screen = screenOf([
		['severe-row', 'severe', -0.14, -0.2],
		['regression-row', 'regression', -0.07, -0.09],
		['near-boundary', 'inconclusive', -0.03, -0.06],
		['far-from-boundary', 'inconclusive', 0.02, -0.04],
		['cleared-row', 'cleared', -0.01, -0.02],
		['improvement-row', 'improvement', 0.2, 0.15],
	])
	assert.deepEqual(confirmationSelection(screen), [
		{ scenario: 'near-boundary', reason: 'boundary' },
		{ scenario: 'regression-row', reason: 'regression' },
		{ scenario: 'severe-row', reason: 'severe' },
	])
})

test('screen severe plus confirm severe fails the gate', () => {
	const screen = screenOf([['a', 'severe', -0.14, -0.2]], { verdict: 'regression' })
	const result = resolveConfirmation(screen, confirmOf([['a', 'severe', -0.13]]))
	assert.equal(result.rows[0].resolution, 'reproduced')
	assert.deepEqual(result.blocking, ['a'])
	assert.equal(result.verdict, 'regression')
})

test('screen severe plus confirm inconclusive is unresolved, which is not a pass', () => {
	// Two fixed batches that disagree about whether a severe regression is there. Re-running
	// until one settles is exactly what the pooled design did, so this ends in a verdict a
	// reader has to look at instead.
	const screen = screenOf([['a', 'severe', -0.14, -0.2]], { verdict: 'regression' })
	const result = resolveConfirmation(screen, confirmOf([['a', 'inconclusive', -0.09]]))
	assert.equal(result.rows[0].resolution, 'unresolved')
	assert.deepEqual(result.blocking, [])
	assert.deepEqual(result.unresolved, ['a'])
	assert.equal(result.verdict, 'unresolved')
	assert.match(renderConfirmationMarkdown(result), /\*\*Unresolved\.\*\* `a`/)
})

test('one severe judgement against one non-judgement is unresolved in either direction', () => {
	// The asymmetry the gate's first real run exposed, with that run's own numbers.
	// `map/collect-all` screened severe at -14.67% and confirmed severe at -11.59%, so it
	// blocks. `set/collect-all` screened inconclusive — interval -42.9% … +26.1%, a row this
	// batch could not judge — and confirmed severe at -30.2%. The first version read only the
	// confirmation batch, so it called that pair `reproduced` while calling the same pair in
	// the other order `unresolved`. Same evidence, two answers.
	const screen = screenOf([
		['map/collect-all', 'severe', -0.1467, -0.182],
		['set/collect-all', 'inconclusive', -0.1513, -0.429],
	], { verdict: 'regression' })
	// Against an empty acknowledgement list, because both of these cells are on the committed one
	// and this case is about the resolution rule rather than about what the repository accepts.
	const result = resolveConfirmation(screen, confirmOf([
		['map/collect-all', 'severe', -0.1159],
		['set/collect-all', 'severe', -0.302],
	]), { acceptedRegressions: [] })
	assert.deepEqual(result.rows.map(row => [row.scenario, row.resolution]), [
		['map/collect-all', 'reproduced'],
		['set/collect-all', 'unresolved'],
	])
	assert.deepEqual(result.blocking, ['map/collect-all'])
	assert.deepEqual(result.unresolved, ['set/collect-all'])
	assert.equal(result.verdict, 'regression', 'the reproduced severe row still decides')

	// And the mirror image: swap which stage judged, and the resolutions swap with it.
	const mirrored = resolveConfirmation(
		screenOf([['a', 'severe', -0.1467, -0.182]], { verdict: 'regression' }),
		confirmOf([['a', 'inconclusive', -0.1513]]),
	)
	assert.deepEqual(mirrored.rows.map(row => row.resolution), ['unresolved'])
	assert.deepEqual(mirrored.unresolved, ['a'])
	assert.equal(mirrored.verdict, 'unresolved')
})

test('a plain regression reproduced is a review, not a failure', () => {
	// Only a severe claim fails the build, which is the rule that failed it before this stage
	// existed. Two batches agreeing on a 7% regression is worth a reader, not a red gate.
	const screen = screenOf([['a', 'regression', -0.07, -0.09]], { verdict: 'review' })
	const result = resolveConfirmation(screen, confirmOf([['a', 'regression', -0.08]]))
	assert.deepEqual(result.rows.map(row => row.resolution), ['reproduced'])
	assert.deepEqual(result.blocking, [])
	assert.equal(result.verdict, 'review')
})

test('screen regression plus confirm cleared passes, with the noise named', () => {
	const screen = screenOf([['a', 'regression', -0.07, -0.09]], { verdict: 'review' })
	const result = resolveConfirmation(screen, confirmOf([['a', 'cleared', -0.01]]))
	assert.equal(result.rows[0].resolution, 'not-reproduced')
	assert.deepEqual(result.notReproduced, ['a'])
	assert.deepEqual(result.reproduced, [])
	assert.equal(result.verdict, 'review', 'a claimed regression that did not reproduce still asks for a reader, but nothing blocks')
	assert.match(renderConfirmationMarkdown(result), /Noise diagnostic.*`a`/s)
})

test('screen severe plus confirm cleared does not fail the gate', () => {
	// The screen's own false positive, measured rather than argued. The hosted-runner null
	// runs produced one of these on a commit compared against itself.
	const screen = screenOf([['a', 'severe', -0.14, -0.2]], { verdict: 'regression' })
	const result = resolveConfirmation(screen, confirmOf([['a', 'cleared', -0.005]]))
	assert.deepEqual(result.blocking, [])
	assert.deepEqual(result.unresolved, [])
	assert.deepEqual(result.notReproduced, ['a'])
	assert.equal(result.verdict, 'review')
})

test('a severe row the confirmation batch never measured is unresolved, not cleared', () => {
	const screen = screenOf([['a', 'severe', -0.14, -0.2]], { verdict: 'regression' })
	const result = resolveConfirmation(screen, confirmOf([]))
	assert.equal(result.rows[0].resolution, 'unmeasured')
	assert.equal(result.verdict, 'unresolved')
})

test('a severe row with no confirmation stage at all still blocks', () => {
	// `confirm == null` is "the second batch did not run", which must not be readable as
	// "the second batch found nothing". Until it runs, the screen's severe row stands.
	const screen = screenOf([['a', 'severe', -0.14, -0.2]], { verdict: 'regression' })
	const result = resolveConfirmation(screen, null)
	assert.equal(result.confirmed, false)
	assert.equal(result.rows[0].resolution, 'unconfirmed')
	assert.deepEqual(result.blocking, ['a'])
	assert.equal(result.verdict, 'regression')
	assert.match(renderConfirmationMarkdown(result), /\*\*Not confirmed\.\*\*/)
})

const accepted = [{ cell: 'a', maxRegressionPercent: 25, because: 'x'.repeat(200) }]

test('an acknowledged regression is reported with its bound instead of blocking', () => {
	// Visible, never absent: a gate whose passing output hides what it forgave is the failure
	// mode this mechanism is most likely to become.
	const screen = screenOf([['a', 'severe', -0.1467, -0.182]], { verdict: 'regression' })
	const result = resolveConfirmation(screen, confirmOf([['a', 'severe', -0.1159]]), { acceptedRegressions: accepted })
	assert.deepEqual(result.rows.map(row => row.resolution), ['acknowledged'])
	assert.deepEqual(result.blocking, [])
	assert.deepEqual(result.acknowledged.map(record => [record.cell, record.bound]), [['a', 25]])
	assert.notEqual(result.verdict, 'regression')
	const markdown = renderConfirmationMarkdown(result)
	assert.match(markdown, /accepted regression\*\*, listed rather than forgiven in silence/)
	assert.match(markdown, /\| `a` \| −14\.67% \| −25% \|/)
})

test('an acknowledged cell past its bound blocks, and the list is reported as wrong', () => {
	const screen = screenOf([['a', 'severe', -0.6, -0.65]], { verdict: 'regression' })
	const result = resolveConfirmation(screen, confirmOf([['a', 'severe', -0.58]]), { acceptedRegressions: accepted })
	assert.deepEqual(result.acknowledged, [])
	assert.equal(result.verdict, 'regression')
	assert.match(result.acknowledgementProblems[0], /a regressed 60\.00%, past the 25% this repository accepts for it/)
	assert.match(renderConfirmationMarkdown(result), /The accepted-regression list is wrong/)
})

test('an acknowledged cell the screen has cleared fails as a stale entry', () => {
	// The cell is cleared, so nothing is selected for confirmation and the row table is empty —
	// which is exactly why staleness is evaluated over every measured row rather than over the
	// selection.
	const screen = screenOf([['a', 'cleared', -0.002]], { verdict: 'neutral' })
	const result = resolveConfirmation(screen, null, { acceptedRegressions: accepted })
	assert.deepEqual(result.rows, [])
	assert.equal(result.verdict, 'regression', 'a list that outlived its reason fails rather than passing quietly')
	assert.match(result.acknowledgementProblems[0], /the accepted regression for a is stale — the screen now reports it cleared at -0\.20%/)
})

test('an acknowledged group stops failing the gate but keeps its true measured value', () => {
	// `warm/failure/all` as CI measured it. The group table still says -6.40% over all nine cells,
	// because a bound says how much of a true number a person agreed to; nothing is excluded from
	// the aggregate.
	const screen = screenOf([['a', 'severe', -0.3237, -0.35]], { verdict: 'regression', severeGroups: ['warm/failure/all'] })
	screen.groups = [{ group: 'warm/failure/all', classification: 'regression', delta: -0.064 }]
	const result = resolveConfirmation(screen, confirmOf([['a', 'severe', -0.2983]]), {
		acceptedRegressions: [{ cell: 'a', maxRegressionPercent: 45, because: 'x'.repeat(200) }],
		acceptedGroupRegressions: [{ group: 'warm/failure/all', maxRegressionPercent: 12, because: 'x'.repeat(200) }],
	})
	assert.deepEqual(result.severeGroups, ['warm/failure/all'], 'the measured trigger is still reported')
	assert.deepEqual(result.unacknowledgedSevereGroups, [], 'and it no longer fails the gate')
	assert.deepEqual(result.acknowledgedGroups.map(record => [record.group, record.bound, Number(record.depthPercent.toFixed(2))]), [['warm/failure/all', 12, 6.40]])
	assert.notEqual(result.verdict, 'regression')
	assert.match(renderConfirmationMarkdown(result), /accepted group regression/)
	assert.match(renderConfirmationMarkdown(result), /\| `warm\/failure\/all` \| −6\.40% \| −12% \|/)
})

test('a group past its bound fails, and an unacknowledged group still fails', () => {
	const screen = screenOf([['a', 'cleared', 0]], { verdict: 'regression', severeGroups: ['warm/failure/all'] })
	screen.groups = [{ group: 'warm/failure/all', classification: 'regression', delta: -0.2 }]
	const past = resolveConfirmation(screen, null, {
		acceptedRegressions: [],
		acceptedGroupRegressions: [{ group: 'warm/failure/all', maxRegressionPercent: 12, because: 'x'.repeat(200) }],
	})
	assert.equal(past.verdict, 'regression')
	assert.match(past.acknowledgementProblems[0], /the group warm\/failure\/all regressed 20\.00%, past the 12%/)

	// An unacknowledged trigger stands, but standing is no longer the same as blocking: with no
	// independent single-runner batch behind it, the evidence is a cross-shard aggregate whose
	// interval cannot see a between-runner shift, so it is reported for review.
	const other = screenOf([['a', 'cleared', 0]], { verdict: 'regression', severeGroups: ['warm/success'] })
	other.groups = [{ group: 'warm/success', classification: 'regression', delta: -0.08, scenarios: 2 }]
	const unacknowledged = resolveConfirmation(other, null, { acceptedRegressions: [], acceptedGroupRegressions: [] })
	assert.deepEqual(unacknowledged.unacknowledgedSevereGroups, ['warm/success'])
	assert.deepEqual(unacknowledged.blockingGroups, [])
	assert.deepEqual(unacknowledged.reviewGroups, ['warm/success'])
	assert.notEqual(unacknowledged.verdict, 'regression')
	assert.match(unacknowledged.groupVerdicts[0].why, /no confirmation batch ran/)
})

test('a cell acknowledgement does not reach a group verdict', () => {
	// Stated as a limit rather than left to be discovered: "did this cell regress?" and "did this
	// affected group broadly regress?" are different questions, and an accepted answer to the
	// first is not an answer to the second.
	const screen = screenOf([['a', 'severe', -0.1467, -0.182]], { verdict: 'regression', severeGroups: ['warm/failure/all'] })
	const result = resolveConfirmation(screen, confirmOf([['a', 'severe', -0.1159]]), { acceptedRegressions: accepted })
	assert.deepEqual(result.rows.map(row => row.resolution), ['acknowledged'])
	assert.deepEqual(result.blocking, [])
	// The cell is forgiven; the group trigger it sits in is untouched by that and remains
	// standing. Whether it blocks is the confirmation's question, not this acknowledgement's.
	assert.deepEqual(result.unacknowledgedSevereGroups, ['warm/failure/all'])
	assert.deepEqual(result.severeGroups, ['warm/failure/all'])
})

test('a severe group with no single-runner confirmation is review, and says why', () => {
	// This case used to block. It no longer does, and the reason is the finding that changed it:
	// the screen's group aggregate mixes runners, and because a cell keeps its shard across every
	// repetition, a between-runner shift in its ratio is a fixed effect the interval cannot see.
	// Blocking on that is blocking on evidence that cannot support it.
	const screen = screenOf([['a', 'cleared', -0.01]], { verdict: 'regression', severeGroups: ['warm/success'] })
	screen.groups = [{ group: 'warm/success', classification: 'regression', delta: -0.08, scenarios: 2 }]
	const result = resolveConfirmation(screen, confirmOf([]))
	assert.deepEqual(result.rows, [])
	assert.deepEqual(result.severeGroups, ['warm/success'])
	assert.deepEqual(result.blockingGroups, [])
	assert.deepEqual(result.reviewGroups, ['warm/success'])
	assert.notEqual(result.verdict, 'regression')
	assert.match(renderConfirmationMarkdown(result), /group triggers? to settle/)
})

test('a clean screen needs no confirmation and keeps its own verdict', () => {
	for (const verdict of ['neutral', 'improvement', 'inconclusive']) {
		const screen = screenOf([['a', 'cleared', 0], ['b', 'inconclusive', 0.01, -0.02]], { verdict })
		const result = resolveConfirmation(screen, null)
		assert.deepEqual(result.rows, [])
		assert.equal(result.verdict, verdict, `${verdict} must survive a stage that had nothing to do`)
	}
})

function screenWithGroup(rows, groups, options = {}) {
	const screen = screenOf(rows, options)
	screen.groups = groups
	// Every row belongs to the first group, so "did the confirmation measure the whole group" has
	// a membership to read. A row with no group belongs to none, which is a different case.
	for (const row of screen.rows)
		row.group = groups[0].group
	return screen
}

test('a triggered group is confirmed on one runner, and only then can block', () => {
	// The finding: a cell keeps its shard across all five repetitions, so a runner-dependent
	// effect on its ratio is a fixed effect that shifts every `G_r` equally and contributes no
	// variance. The screen's group interval cannot widen for it, so a tight group interval can
	// still be displaced by which runners the shards drew — bias, not noise. A blocking group
	// therefore needs an independent single-runner batch that agrees.
	const rows = [['a', 'inconclusive', -0.06, -0.09], ['b', 'inconclusive', -0.07, -0.1]]
	const groups = [{ group: 'warm/failure/all', classification: 'regression', delta: -0.064, scenarios: 2 }]
	const screen = screenWithGroup(rows, groups, { verdict: 'regression', severeGroups: ['warm/failure/all'] })

	const confirm = confirmOf([['a', 'regression', -0.062], ['b', 'regression', -0.068]])
	confirm.measurement = { shardCount: 1 }
	confirm.groups = [{ group: 'warm/failure/all', classification: 'regression', delta: -0.065, scenarios: 2 }]
	const blocked = resolveConfirmation(screen, confirm, { acceptedRegressions: [], acceptedGroupRegressions: [] })
	assert.deepEqual(blocked.blockingGroups, ['warm/failure/all'])
	assert.equal(blocked.verdict, 'regression')
	assert.match(blocked.groupVerdicts[0].why, /independent single-runner batch measured the whole group and agreed/)
})

test('a group confirmed across four shards is review, not blocking', () => {
	// Confirming a cross-runner aggregate on four more runners would reproduce the very defect
	// being corrected, so the evidence cannot support blocking however severe it looks.
	const rows = [['a', 'inconclusive', -0.06, -0.09], ['b', 'inconclusive', -0.07, -0.1]]
	const groups = [{ group: 'warm/failure/all', classification: 'regression', delta: -0.064, scenarios: 2 }]
	const screen = screenWithGroup(rows, groups, { verdict: 'regression', severeGroups: ['warm/failure/all'] })
	const confirm = confirmOf([['a', 'regression', -0.062], ['b', 'regression', -0.068]])
	confirm.measurement = { shardCount: 4 }
	confirm.groups = [{ group: 'warm/failure/all', classification: 'regression', delta: -0.065, scenarios: 2 }]
	const result = resolveConfirmation(screen, confirm, { acceptedRegressions: [], acceptedGroupRegressions: [] })
	assert.deepEqual(result.blockingGroups, [])
	assert.deepEqual(result.reviewGroups, ['warm/failure/all'])
	assert.notEqual(result.verdict, 'regression')
	assert.match(result.groupVerdicts[0].why, /ran over 4 shards, so its group aggregate mixes runners/)
	assert.match(renderConfirmationMarkdown(result), /\| `warm\/failure\/all` \| no \| regression \|/)
})

test('a group the confirmation did not measure in full cannot block', () => {
	// Reading a group aggregate over the part of a group that happened to be selected would be
	// exactly the outcome-conditioned estimate the group estimator was rebuilt to remove.
	const rows = [['a', 'inconclusive', -0.06, -0.09], ['b', 'inconclusive', -0.07, -0.1]]
	const groups = [{ group: 'warm/failure/all', classification: 'regression', delta: -0.064, scenarios: 2 }]
	const screen = screenWithGroup(rows, groups, { verdict: 'regression', severeGroups: ['warm/failure/all'] })
	const confirm = confirmOf([['a', 'regression', -0.062]])
	confirm.measurement = { shardCount: 1 }
	confirm.groups = [{ group: 'warm/failure/all', classification: 'regression', delta: -0.062, scenarios: 1 }]
	const result = resolveConfirmation(screen, confirm, { acceptedRegressions: [], acceptedGroupRegressions: [] })
	assert.deepEqual(result.blockingGroups, [])
	assert.match(result.groupVerdicts[0].why, /did not measure every cell of the group/)
})

test('a single-runner batch that clears the group turns the trigger into review', () => {
	const rows = [['a', 'inconclusive', -0.06, -0.09], ['b', 'inconclusive', -0.07, -0.1]]
	const groups = [{ group: 'warm/failure/all', classification: 'regression', delta: -0.064, scenarios: 2 }]
	const screen = screenWithGroup(rows, groups, { verdict: 'regression', severeGroups: ['warm/failure/all'] })
	const confirm = confirmOf([['a', 'cleared', 0.001], ['b', 'cleared', -0.002]])
	confirm.measurement = { shardCount: 1 }
	confirm.groups = [{ group: 'warm/failure/all', classification: 'cleared', delta: -0.001, scenarios: 2 }]
	const result = resolveConfirmation(screen, confirm, { acceptedRegressions: [], acceptedGroupRegressions: [] })
	assert.deepEqual(result.blockingGroups, [])
	assert.notEqual(result.verdict, 'regression')
	assert.match(result.groupVerdicts[0].why, /reported it cleared/)
})

test('the plan measures the whole triggered group, on one runner, and shows its arithmetic', () => {
	const rows = [['a', 'severe', -0.14, -0.2], ['b', 'cleared', 0], ['c', 'inconclusive', -0.02, -0.03]]
	const screen = screenWithGroup(rows, [{ group: 'g', classification: 'regression', delta: -0.064, scenarios: 3 }], { verdict: 'regression', severeGroups: ['g'] })
	for (const row of screen.rows)
		row.group = 'g'
	const plan = confirmationPlan(screen)
	// Every cell of the group, including the cleared one the cell selection would never pick.
	assert.deepEqual(plan.cells, ['a', 'b', 'c'])
	assert.equal(plan.shardCount, 1, 'one runner whenever a group is at stake')
	assert.deepEqual(plan.groups, ['g'])
	assert.deepEqual(plan.unconfirmableGroups, [])
	// 3 cells x 5 repetitions x 2 sides x 2.33 s + 120 s of overhead.
	assert.equal(Number(plan.budget.measurementSeconds.toFixed(1)), 69.9)
	assert.equal(plan.budget.fitsOneRunner, true)
})

test('a group too large for one runner is review, and the arithmetic says why', () => {
	// `warm/success` is 124 cells: 124 x 5 x 2 x 2.33 s is 48.2 min, and with a confirmation
	// batch beside it the batch cannot fit the 45 min a single runner is allowed. The fallback is
	// forced by that arithmetic rather than chosen, and the plan reports it rather than blocking
	// on evidence that cannot support it.
	const rows = Array.from({ length: 124 }, (unused, index) => [`cell-${index}`, 'inconclusive', -0.06, -0.09])
	const screen = screenWithGroup(rows, [{ group: 'warm/success', classification: 'regression', delta: -0.064, scenarios: 124 }], { verdict: 'regression', severeGroups: ['warm/success'] })
	for (const row of screen.rows)
		row.group = 'warm/success'
	const plan = confirmationPlan(screen)
	assert.equal(plan.budget.fitsOneRunner, false)
	assert.ok(plan.budget.totalSeconds > plan.budget.budgetSeconds)
	assert.deepEqual(plan.groups, [])
	assert.deepEqual(plan.unconfirmableGroups, ['warm/success'])
	assert.equal(plan.shardCount, 4, 'the cell confirmation still shards; only the group falls back')
})

test('an acknowledged group is never queued for confirmation', () => {
	const screen = screenWithGroup([['a', 'cleared', 0]], [{ group: 'warm/failure/all', classification: 'regression', delta: -0.064, scenarios: 2 }], { verdict: 'regression', severeGroups: ['warm/failure/all'] })
	const plan = confirmationPlan(screen, { acknowledgedGroups: new Set(['warm/failure/all']) })
	assert.deepEqual([plan.groups, plan.unconfirmableGroups, plan.cells], [[], [], []])
})

test('the budget constants are the measured ones', () => {
	// From run 30547023911: 1429 s per screen shard for 245/4 x 5 x 2 = 613 cell-runs.
	assert.equal(Number((1429 / ((245 / 4) * 5 * 2)).toFixed(2)), secondsPerCellRun)
	assert.equal(confirmationBudgetSeconds, 45 * 60, 'three quarters of the job timeout, leaving room for a slower runner')
	assert.equal(confirmationBudget(9).fitsOneRunner, true, 'the nine-cell collect-all group fits easily')
})
