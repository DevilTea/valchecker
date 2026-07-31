import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
	confirmationBudget,
	confirmationBudgetSeconds,
	confirmationPlan,
	confirmationSelection,
	planSummaryLines,
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
		// `intervalHigh` as well as `intervalLow`: a bound is judged against the interval, so a
		// fixture without one cannot be classified against it at all.
		rows: rows.map(([scenario, classification, delta, intervalLow = delta - 0.01, intervalHigh = delta + 0.01]) => ({
			scenario,
			classification,
			delta,
			intervalLow,
			intervalHigh,
		})),
	}
}

function confirmOf(rows) {
	return {
		runCounts: { baseline: 5, candidate: 5 },
		rows: rows.map(([scenario, classification, delta, intervalLow = delta - 0.01, intervalHigh = delta + 0.01]) => ({
			scenario,
			classification,
			delta,
			intervalLow,
			intervalHigh,
		})),
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
	assert.match(result.acknowledgementProblems[0], /a breached its 25% bound \(deepest estimate 60\.00%\) — both batches place the whole interval past the bound/)
	assert.match(renderConfirmationMarkdown(result), /The accepted-regression list is wrong/)
})

test('an acknowledged cell both batches clear fails as a stale entry', () => {
	// Staleness is still evaluated over every measured row rather than over the confirmation
	// selection — a cleared cell is not selected by the row rule — but it now needs the
	// confirmation batch to agree, which is why an acknowledged cell is always queued for it.
	const screen = screenOf([['a', 'cleared', -0.002]], { verdict: 'neutral' })
	const result = resolveConfirmation(screen, confirmOf([['a', 'cleared', -0.001]]), { acceptedRegressions: accepted })
	assert.equal(result.verdict, 'regression', 'a list that outlived its reason fails rather than passing quietly')
	assert.match(result.acknowledgementProblems[0], /the accepted regression for a is stale/)
})

test('an acknowledged cell only the screen cleared is unassessed, not stale', () => {
	const screen = screenOf([['a', 'cleared', -0.002]], { verdict: 'neutral' })
	const result = resolveConfirmation(screen, null, { acceptedRegressions: accepted })
	assert.deepEqual(result.acknowledgementProblems, [])
	assert.match(result.unassessedAcknowledgements[0], /no confirmation batch measured it/)
	assert.notEqual(result.verdict, 'regression')
	assert.match(renderConfirmationMarkdown(result), /rot check this run could not perform/)
})

/**
 * One group's own single-runner confirmation batch, as the workflow produces one: its cells, its
 * aggregate, and the shard count that decides whether it is single-runner evidence at all.
 */
function groupConfirmation(name, classification, delta, cells, { shardCount = 1, width = 0.01 } = {}) {
	return {
		runCounts: { baseline: 5, candidate: 5 },
		measurement: { shardCount },
		rows: cells.map(cell => ({ scenario: cell, classification: 'regression', delta, intervalLow: delta - width, intervalHigh: delta + width })),
		groups: [{ group: name, classification, delta, scenarios: cells.length, intervalLow: delta - width, intervalHigh: delta + width }],
	}
}

/** A screen carrying one group and rows that belong to it. */
function groupScreen(cells, { classification = 'regression', delta = -0.064, group = 'warm/failure/all', width = 0.007, verdict = 'regression' } = {}) {
	const screen = screenOf(cells.map(cell => [cell, 'inconclusive', -0.06, -0.09, -0.03]), { verdict, severeGroups: [group] })
	screen.groups = [{ group, classification, delta, scenarios: cells.length, intervalLow: delta - width, intervalHigh: delta + width }]
	for (const row of screen.rows)
		row.group = group
	return screen
}

test('an acknowledged group stops failing the gate but keeps its true measured value', () => {
	// The group table still says -6.40% over all nine cells, because a bound says how much of a
	// true number a person agreed to; nothing is excluded from the aggregate.
	const screen = groupScreen(['a', 'b'])
	const result = resolveConfirmation(screen, null, {
		acceptedRegressions: [],
		acceptedGroupRegressions: [{ group: 'warm/failure/all', maxRegressionPercent: 12, because: 'x'.repeat(200) }],
		groupConfirmations: { 'warm/failure/all': groupConfirmation('warm/failure/all', 'regression', -0.064, ['a', 'b']) },
	})
	assert.deepEqual(result.severeGroups, ['warm/failure/all'], 'the measured trigger is still reported')
	assert.deepEqual(result.unacknowledgedSevereGroups, [], 'and it no longer fails the gate')
	assert.deepEqual(result.acknowledgedGroups.map(record => [record.group, record.bound, Number(record.depthPercent.toFixed(2))]), [['warm/failure/all', 12, 6.40]])
	assert.notEqual(result.verdict, 'regression')
	assert.match(renderConfirmationMarkdown(result), /accepted group regression/)
	assert.match(renderConfirmationMarkdown(result), /\| `warm\/failure\/all` \| −6\.40% \| −12% \|/)
})

test('a group breaches its bound only when both batches place the interval past it', () => {
	const screen = groupScreen(['a', 'b'], { delta: -0.2, width: 0.01 })
	const both = resolveConfirmation(screen, null, {
		acceptedRegressions: [],
		acceptedGroupRegressions: [{ group: 'warm/failure/all', maxRegressionPercent: 12, because: 'x'.repeat(200) }],
		groupConfirmations: { 'warm/failure/all': groupConfirmation('warm/failure/all', 'regression', -0.2, ['a', 'b']) },
	})
	assert.equal(both.verdict, 'regression')
	assert.match(both.acknowledgementProblems[0], /the group warm\/failure\/all breached its 12% bound/)

	// And a confirmation breach the screen does not reproduce is unassessed rather than red.
	const oneSided = resolveConfirmation(groupScreen(['a', 'b']), null, {
		acceptedRegressions: [],
		acceptedGroupRegressions: [{ group: 'warm/failure/all', maxRegressionPercent: 12, because: 'x'.repeat(200) }],
		groupConfirmations: { 'warm/failure/all': groupConfirmation('warm/failure/all', 'regression', -0.2, ['a', 'b']) },
	})
	assert.deepEqual(oneSided.acknowledgementProblems, [])
	assert.match(oneSided.unassessedAcknowledgements[0], /not independently reproduced/)
})

test('a cell acknowledgement does not reach a group verdict', () => {
	// "Did this cell regress?" and "did this affected group broadly regress?" are different
	// questions, and an accepted answer to the first is not an answer to the second.
	const screen = screenOf([['a', 'severe', -0.1467, -0.182]], { verdict: 'regression', severeGroups: ['warm/failure/all'] })
	const result = resolveConfirmation(screen, confirmOf([['a', 'severe', -0.1159]]), { acceptedRegressions: accepted })
	assert.deepEqual(result.rows.map(row => row.resolution), ['acknowledged'])
	assert.deepEqual(result.blocking, [])
	assert.deepEqual(result.unacknowledgedSevereGroups, ['warm/failure/all'])
	assert.deepEqual(result.severeGroups, ['warm/failure/all'])
})

test('a severe group with no single-runner confirmation is review, and says why', () => {
	// This case used to block. It no longer does: the screen's group aggregate mixes runners, and
	// because a cell keeps its shard across every repetition a between-runner shift in its ratio is
	// a fixed effect the interval cannot see. Blocking on that is blocking on evidence that cannot
	// support it.
	const screen = groupScreen(['a', 'b'], { group: 'warm/success' })
	const result = resolveConfirmation(screen, null, { acceptedRegressions: [], acceptedGroupRegressions: [] })
	assert.deepEqual(result.severeGroups, ['warm/success'])
	assert.deepEqual(result.blockingGroups, [])
	assert.deepEqual(result.reviewGroups, ['warm/success'])
	assert.notEqual(result.verdict, 'regression')
	assert.match(result.groupVerdicts[0].why, /no single-runner batch measured this group/)
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

test('a triggered group blocks only when its own single-runner batch agrees', () => {
	const screen = groupScreen(['a', 'b'])
	const blocked = resolveConfirmation(screen, null, {
		acceptedRegressions: [],
		acceptedGroupRegressions: [],
		groupConfirmations: { 'warm/failure/all': groupConfirmation('warm/failure/all', 'regression', -0.065, ['a', 'b']) },
	})
	assert.deepEqual(blocked.blockingGroups, ['warm/failure/all'])
	assert.equal(blocked.verdict, 'regression')
	assert.match(blocked.groupVerdicts[0].why, /independent single-runner batch measured the whole group and agreed/)
})

test('a group whose own batch ran sharded is review, not blocking', () => {
	// Confirming a cross-runner aggregate on four more runners would reproduce the defect being
	// corrected, so the evidence cannot support blocking however severe it looks.
	const screen = groupScreen(['a', 'b'])
	const result = resolveConfirmation(screen, null, {
		acceptedRegressions: [],
		acceptedGroupRegressions: [],
		groupConfirmations: { 'warm/failure/all': groupConfirmation('warm/failure/all', 'regression', -0.065, ['a', 'b'], { shardCount: 4 }) },
	})
	assert.deepEqual(result.blockingGroups, [])
	assert.deepEqual(result.reviewGroups, ['warm/failure/all'])
	assert.match(result.groupVerdicts[0].why, /ran over 4 shards/)
	assert.match(renderConfirmationMarkdown(result), /\| `warm\/failure\/all` \| no \| regression \|/)
})

test('a group whose batch missed a cell cannot block', () => {
	// Reading an aggregate over the part of a group that happened to be measured would be exactly
	// the outcome-conditioned estimate the group estimator was rebuilt to remove.
	const screen = groupScreen(['a', 'b'])
	const result = resolveConfirmation(screen, null, {
		acceptedRegressions: [],
		acceptedGroupRegressions: [],
		groupConfirmations: { 'warm/failure/all': groupConfirmation('warm/failure/all', 'regression', -0.065, ['a']) },
	})
	assert.deepEqual(result.blockingGroups, [])
	assert.match(result.groupVerdicts[0].why, /did not measure every cell of the group/)
})

test('a single-runner batch that clears the group turns the trigger into review', () => {
	const screen = groupScreen(['a', 'b'])
	const result = resolveConfirmation(screen, null, {
		acceptedRegressions: [],
		acceptedGroupRegressions: [],
		groupConfirmations: { 'warm/failure/all': groupConfirmation('warm/failure/all', 'cleared', -0.001, ['a', 'b']) },
	})
	assert.deepEqual(result.blockingGroups, [])
	assert.notEqual(result.verdict, 'regression')
	assert.match(result.groupVerdicts[0].why, /reported it cleared/)
})

test('a group is scheduled in its own batch, on one runner, sized by its own cells', () => {
	const screen = groupScreen(['a', 'b', 'c'])
	const plan = confirmationPlan(screen)
	const groupBatch = plan.batches.find(batch => batch.kind === 'group')
	assert.deepEqual(groupBatch.cells, ['a', 'b', 'c'], 'every cell of the group, including ones the row rule would skip')
	assert.equal(groupBatch.shardCount, 1, 'one runner whenever a group is at stake')
	assert.equal(groupBatch.group, 'warm/failure/all')
	assert.deepEqual(plan.groups, ['warm/failure/all'])
	// 3 cells x 5 repetitions x 2 sides x 2.33 s + 120 s of overhead.
	assert.equal(Number(plan.groupBudgets[0].measurementSeconds.toFixed(1)), 69.9)
})

test('unrelated row confirmations cannot cost a group its confirmability', () => {
	// The coupling this removes. A group that fits a single runner comfortably by itself used to be
	// downgraded to `review` because unrelated boundary rows also needed confirming, and two groups
	// that each fitted alone but not together left neither able to block.
	const screen = groupScreen(['g1', 'g2'])
	for (let index = 0; index < 130; index++) {
		screen.rows.push({ scenario: `x/${index}`, classification: 'inconclusive', delta: -0.06, intervalLow: -0.09, intervalHigh: -0.03, group: 'warm/success' })
	}
	const plan = confirmationPlan(screen)
	assert.deepEqual(plan.groups, ['warm/failure/all'], 'the group is still confirmable')
	assert.deepEqual(plan.unconfirmableGroups, [])
	const rowBatches = plan.batches.filter(batch => batch.kind === 'rows')
	assert.equal(rowBatches.length, 4, 'while the rows shard four ways as usual')
	assert.equal(plan.batches.find(batch => batch.kind === 'group').cells.length, 2)
})

test('a group too large for one runner is review, and the arithmetic says why', () => {
	// `warm/success` is 124 cells: 124 x 5 x 2 x 2.33 s is 48.2 min against the 45 min a single
	// runner is allowed, so the fallback is forced by arithmetic rather than chosen.
	const screen = groupScreen(Array.from({ length: 124 }, (unused, index) => `cell-${index}`), { group: 'warm/success' })
	const plan = confirmationPlan(screen)
	assert.deepEqual(plan.groups, [])
	assert.deepEqual(plan.unconfirmableGroups, ['warm/success'])
	assert.equal(plan.groupBudgets[0].fitsOneRunner, false)
	assert.ok(plan.groupBudgets[0].totalSeconds > plan.groupBudgets[0].budgetSeconds)
	assert.equal(plan.batches.filter(batch => batch.kind === 'group').length, 0)
})

test('an acknowledged group is queued for confirmation, so its entry stays falsifiable', () => {
	// Not to decide whether it blocks — it cannot block — but to decide whether the entry should
	// still exist. An acknowledgement nobody ever remeasures cannot be retired.
	const screen = groupScreen(['a', 'b'])
	const plan = confirmationPlan(screen, { acknowledgedGroups: new Set(['warm/failure/all']) })
	assert.deepEqual(plan.groups, ['warm/failure/all'])
	assert.deepEqual(plan.batches.find(batch => batch.kind === 'group').cells, ['a', 'b'])
})

test('an acknowledged cell is queued even when the row rule would skip it', () => {
	// A cleared cell is exactly the case that decides whether its entry should still exist, and
	// exactly the case the row selection ignores. It rides with the rows: it needs no single runner
	// and must not enter any group's budget.
	const screen = screenOf([['a', 'cleared', -0.002], ['b', 'cleared', 0]], { verdict: 'neutral' })
	const plan = confirmationPlan(screen, { acknowledgedCells: new Set(['a']) })
	assert.deepEqual(plan.batches.map(batch => [batch.kind, batch.cells]), [['rows', ['a']]])
	assert.deepEqual(plan.reasons.map(entry => entry.reason), ['acknowledged'])
})

test('the budget constants are the measured ones', () => {
	// From run 30547023911: 1429 s per screen shard for 245/4 x 5 x 2 = 613 cell-runs.
	assert.equal(Number((1429 / ((245 / 4) * 5 * 2)).toFixed(2)), secondsPerCellRun)
	assert.equal(confirmationBudgetSeconds, 45 * 60, 'three quarters of the job timeout, leaving room for a slower runner')
	assert.equal(confirmationBudget(9).fitsOneRunner, true, 'the nine-cell collect-all group fits easily')
})

test('the plan summary reads every field the plan actually has', () => {
	// The regression this covers: the summary lived in the CLI, went stale when the planner moved
	// to independent batches, and killed the compare job with `TypeError: Cannot read properties
	// of undefined (reading 'totalSeconds')`. A hand-built fixture never exercised it because the
	// tests called the planner directly and the CLI was assumed thin. It was not thin — formatting
	// the plan is logic about the plan — so it lives here now and a shape change fails a test.
	const screen = groupScreen(['a', 'b'])
	for (let index = 0; index < 6; index++)
		screen.rows.push({ scenario: `x/${index}`, classification: 'severe', delta: -0.2, intervalLow: -0.25, intervalHigh: -0.15, group: 'warm/success' })
	const lines = planSummaryLines(confirmationPlan(screen))
	assert.match(lines.join('\n'), /\[confirm\] rows: 8 cell\(s\) over 4 shard\(s\), \d+s of measurement/)
	assert.match(lines.join('\n'), /\[confirm\] group warm\/failure\/all: 2 cell\(s\) on one runner, 2\.8 min of a 45 min budget/)
})

test('the plan summary handles a plan with no groups and a plan with nothing to do', () => {
	// The two shapes the crash showed nobody had exercised: rows without groups, and an empty
	// plan. Neither may throw, and the empty one must say what it means rather than print nothing.
	const rowsOnly = screenOf([['a', 'severe', -0.2, -0.25, -0.15]], { verdict: 'regression' })
	const rowLines = planSummaryLines(confirmationPlan(rowsOnly))
	assert.match(rowLines.join('\n'), /rows: 1 cell\(s\) over 1 shard\(s\)/)
	assert.equal(rowLines.some(line => line.includes('group')), false)

	const empty = planSummaryLines(confirmationPlan(screenOf([['a', 'cleared', 0]], { verdict: 'neutral' })))
	assert.deepEqual(empty.length, 1)
	assert.match(empty[0], /nothing to confirm/)
})

test('a group with no budget entry is described rather than crashed on', () => {
	// The shape the reviewer named: a group batch whose cost entry is missing. It cannot arise
	// from `confirmationPlan` today, and a summary that throws on it would be another job-killing
	// `TypeError` rather than a report.
	const lines = planSummaryLines({
		batches: [{ id: 'group-g', kind: 'group', group: 'g', cells: ['a'], shardIndex: 0, shardCount: 1 }],
		groupBudgets: [],
		unconfirmableGroups: ['h'],
		rowBudget: confirmationBudget(0),
	})
	assert.match(lines.join('\n'), /group g: 1 cell\(s\) on one runner$/m)
	assert.match(lines.join('\n'), /group h cannot be confirmed on one runner — it is review, not blocking/)
})
