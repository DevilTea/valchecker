import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
	acceptedGroupRegressions,
	acceptedRegressions,
	deepestRegressionPercent,
	evaluateAcceptedGroupRegressions,
	evaluateAcceptedRegressions,
	groupsWithoutAcknowledgedCells,
	malformedAcceptedGroupRegressions,
	malformedAcceptedRegressions,
	unknownAcceptedGroupRegressions,
	unknownAcceptedRegressions,
} from './accepted-regressions.mjs'

/**
 * The acknowledgement's rules, and the rot checks that keep it from becoming an escape hatch.
 *
 * The numbers are the ones two hosted CI comparisons of this pull request produced for the
 * two accepted cells, so the fixtures are the case the list exists for rather than a
 * hypothetical.
 */

/**
 * A row as the comparison produces one, intervals included — a bound is a decision threshold and
 * is judged against the interval, never against the point estimate. The intervals default to a
 * tight band around each delta so a case that is not about noise does not have to say so.
 */
function row(scenario, screen, screenDelta, confirm = null, confirmDelta = null, { width = 0.01 } = {}) {
	return {
		scenario,
		screen,
		screenDelta,
		screenLow: screenDelta - width,
		screenHigh: screenDelta + width,
		confirm,
		confirmDelta,
		confirmLow: confirmDelta == null ? null : confirmDelta - width,
		confirmHigh: confirmDelta == null ? null : confirmDelta + width,
	}
}

test('the committed list is well formed and every entry states a reason', () => {
	assert.deepEqual(malformedAcceptedRegressions(), [])
	assert.deepEqual(acceptedRegressions.map(entry => entry.cell), ['map/collect-all', 'set/collect-all'])
	for (const entry of acceptedRegressions) {
		assert.ok(entry.maxRegressionPercent > 0, `${entry.cell} needs a bound`)
		assert.match(entry.because, /collectAllIssues|firstIndex/, `${entry.cell}'s reason must name the change that caused it`)
	}
})

test('an entry with no bound, no reason, or a repeated cell is refused', () => {
	assert.deepEqual(malformedAcceptedRegressions([{ cell: '', maxRegressionPercent: 10, because: 'x'.repeat(200) }]), [
		'an accepted-regression entry names no cell',
	])
	assert.deepEqual(malformedAcceptedRegressions([{ cell: 'a/b', maxRegressionPercent: 0, because: 'x'.repeat(200) }]), [
		'the accepted-regression entry for \'a/b\' records no positive `maxRegressionPercent`, so it would accept a regression of any depth',
	])
	// A bound with no argument behind it is the escape hatch this mechanism must not become.
	assert.match(malformedAcceptedRegressions([{ cell: 'a/b', maxRegressionPercent: 10, because: 'it is fine' }])[0], /needs a reason of at least 200 characters/)
	const twice = [
		{ cell: 'a/b', maxRegressionPercent: 10, because: 'x'.repeat(200) },
		{ cell: 'a/b', maxRegressionPercent: 90, because: 'x'.repeat(200) },
	]
	assert.match(malformedAcceptedRegressions(twice)[0], /names 'a\/b' twice/)
})

test('an entry naming a cell the catalog does not declare is refused', () => {
	// The rot direction a script can decide with no measurement at all.
	const catalog = [{ id: 'map/collect-all' }, { id: 'set/collect-all' }]
	assert.deepEqual(unknownAcceptedRegressions(catalog), [])
	assert.deepEqual(unknownAcceptedRegressions([{ id: 'map/collect-all' }]), ['set/collect-all'])
})

test('a measured regression inside its bound is acknowledged and does not block', () => {
	// `map/collect-all` as the first CI comparison measured it: severe at -14.67% in the screen
	// and severe at -11.59% in an independent confirmation batch, against a 25% bound.
	const { acknowledged, exceeded, stale } = evaluateAcceptedRegressions([
		row('map/collect-all', 'severe', -0.1467, 'severe', -0.1159),
	])
	assert.deepEqual(exceeded, [])
	assert.deepEqual(stale, [])
	assert.equal(acknowledged.length, 1)
	assert.equal(acknowledged[0].cell, 'map/collect-all')
	assert.equal(acknowledged[0].bound, 25)
	assert.equal(Number(acknowledged[0].depthPercent.toFixed(2)), 14.67, 'the deepest of the two stages is what the bound is checked against')
})

test('a breach both batches reproduce still fails', () => {
	// The property that keeps this from being a suppression: -60% on an accepted cell is not the
	// accepted cost. Both batches must place the whole interval past the bound, and the message
	// carries the numbers, because "we accepted 45% and measured 60%" is a different
	// conversation from "this regressed".
	const { acknowledged, exceeded } = evaluateAcceptedRegressions([
		row('set/collect-all', 'severe', -0.6, 'severe', -0.58),
	])
	assert.deepEqual(acknowledged, [])
	assert.equal(exceeded.length, 1)
	assert.equal(exceeded[0].bound, 45)
	assert.equal(Number(exceeded[0].depthPercent.toFixed(1)), 60)
	assert.match(exceeded[0].why, /both batches place the whole interval past the bound/)
})

test('a breach one batch does not reproduce is unassessed, not a red gate', () => {
	// The perverse case this rule removes: a noisy screen at -60% followed by a confirmation
	// `cleared` at 0% used to be reported as a breach and fail the workflow — while the same row
	// *without* an acknowledgement would have been `not-reproduced` and would not have blocked.
	// Adding an acknowledgement made the gate stricter than having none.
	const result = evaluateAcceptedRegressions([row('set/collect-all', 'severe', -0.6, 'cleared', 0)])
	assert.deepEqual([result.exceeded, result.acknowledged], [[], []])
	assert.match(result.unassessed[0].why, /not independently reproduced/)
})

test('an interval spanning the bound is unassessed in either direction', () => {
	// A -40% point estimate whose interval runs past -45% cannot establish that the cost is
	// inside the bound, and must not be quietly accepted as if it had.
	const spanning = evaluateAcceptedRegressions([row('set/collect-all', 'severe', -0.4, 'severe', -0.4, { width: 0.1 })])
	assert.deepEqual([spanning.acknowledged, spanning.exceeded], [[], []])
	assert.match(spanning.unassessed[0].why, /spans the bound/)
})

test('an entry is stale only when both measurements agree the cost is gone', () => {
	// So the list shrinks as the code improves: somebody optimizing the buffered path finds the
	// gate red until they delete the entry. Both measurements, because one is not enough in
	// either direction — a cell keeps its shard across every repetition, so a runner-dependent
	// shift in its ratio moves the estimate without widening the interval, which is why an
	// acknowledged cell is always queued for the confirmation batch.
	const { stale, acknowledged } = evaluateAcceptedRegressions([row('map/collect-all', 'cleared', -0.004, 'cleared', -0.002)])
	assert.deepEqual(acknowledged, [])
	assert.deepEqual(stale.map(record => [record.cell, record.screen, record.confirm]), [['map/collect-all', 'cleared', 'cleared']])
	assert.deepEqual(
		evaluateAcceptedRegressions([row('set/collect-all', 'improvement', 0.2, 'improvement', 0.18)]).stale.map(record => record.cell),
		['set/collect-all'],
	)
})

test('one clear reading against a disagreeing or missing second is unassessed, not stale', () => {
	// The asymmetry this removes: blocking already needed two readings, so retiring an entry
	// cannot need one. An unassessed check is reported and neither passes nor fails.
	const disagreeing = evaluateAcceptedRegressions([row('map/collect-all', 'cleared', -0.004, 'severe', -0.12)])
	assert.deepEqual([disagreeing.stale, disagreeing.acknowledged], [[], []])
	assert.match(disagreeing.unassessed[0].why, /the two do not agree that the cost is gone/)

	const unmeasured = evaluateAcceptedRegressions([row('map/collect-all', 'cleared', -0.004)])
	assert.deepEqual(unmeasured.stale, [])
	assert.match(unmeasured.unassessed[0].why, /no confirmation batch measured it/)
})

test('a run that could not judge the cell leaves its entry alone', () => {
	// `map/collect-all` in the second CI comparison: inconclusive at -7.67% in the screen and
	// -6.70% in the confirmation batch. Two batches that cannot judge a cell are not evidence
	// that the accepted cost is gone, so calling the entry stale here would turn a noisy runner
	// into a red gate — the failure mode `stabilityThreshold` was removed for.
	const { acknowledged, exceeded, stale } = evaluateAcceptedRegressions([
		row('map/collect-all', 'inconclusive', -0.0767, 'inconclusive', -0.067),
	])
	assert.deepEqual([acknowledged, exceeded, stale], [[], [], []])
})

test('a cell nobody measured is not evidence either way', () => {
	assert.deepEqual(evaluateAcceptedRegressions([]), { acknowledged: [], exceeded: [], stale: [], unassessed: [] })
	assert.deepEqual(evaluateAcceptedRegressions([row('string/valid', 'severe', -0.3)]).acknowledged, [], 'an unlisted cell is never acknowledged')
})

test('the depth read is the deepest either stage measured', () => {
	assert.equal(Number(deepestRegressionPercent(row('a', 'severe', -0.1513, 'severe', -0.302))
		.toFixed(2)), 30.20)
	assert.equal(deepestRegressionPercent(row('a', 'cleared', 0.05, 'cleared', 0.02)), 0, 'an improvement has no depth')
	assert.equal(deepestRegressionPercent(row('a', 'severe', -0.2)), 20)
})

const catalog = [
	{ id: 'map/collect-all', group: 'warm/failure/all' },
	{ id: 'set/collect-all', group: 'warm/failure/all' },
	{ id: 'object/collect-all', group: 'warm/failure/all' },
	{ id: 'string/valid', group: 'warm/success' },
]

test('the committed group acknowledgement list is empty after the confirmed group cost cleared', () => {
	assert.deepEqual(malformedAcceptedGroupRegressions(), [])
	assert.deepEqual(acceptedGroupRegressions, [])
})

const acceptedFailureGroup = [{
	group: 'warm/failure/all',
	maxRegressionPercent: 12,
	because: 'Synthetic group acknowledgement used only to exercise the generic acknowledgement machinery after the repository retired its real warm/failure/all entry. The fixture deliberately remains long enough to satisfy the same reviewability rule as committed entries, while no production gate consumes it.',
}]

function group(name, classification, delta, width = 0.01) {
	return { group: name, classification, delta, intervalLow: delta - width, intervalHigh: delta + width }
}

/** A single-runner confirmation that measured the whole group, reporting the given aggregate. */
function confirmedGroup(name, classification, delta, width = 0.01) {
	return { groups: [group(name, classification, delta, width)], singleRunner: true, measuredWhole: () => true }
}

test('a group aggregate is judged from the single-runner confirmation, inside its bound and past it', () => {
	// `warm/failure/all` as CI measured it: -6.40%, interval [-7.1%, -5.7%], against a 12% bound.
	const screen = [group('warm/failure/all', 'regression', -0.064)]
	const within = evaluateAcceptedGroupRegressions(screen, confirmedGroup('warm/failure/all', 'regression', -0.064), acceptedFailureGroup)
	assert.equal(within.acknowledged.length, 1)
	assert.equal(within.acknowledged[0].bound, 12)
	assert.equal(Number(within.acknowledged[0].depthPercent.toFixed(2)), 6.40)
	assert.deepEqual([within.exceeded, within.unassessed], [[], []])

	// A breach needs both batches, here a screen and a confirmation that agree.
	const pastScreen = [group('warm/failure/all', 'regression', -0.2)]
	const past = evaluateAcceptedGroupRegressions(pastScreen, confirmedGroup('warm/failure/all', 'regression', -0.2), acceptedFailureGroup)
	assert.deepEqual(past.acknowledged, [])
	assert.equal(Number(past.exceeded[0].depthPercent.toFixed(1)), 20, 'a group effect roughly tripled still fails')

	// And a confirmation breach the screen does not reproduce is unassessed rather than red.
	const unreproduced = evaluateAcceptedGroupRegressions(screen, confirmedGroup('warm/failure/all', 'regression', -0.2), acceptedFailureGroup)
	assert.deepEqual([unreproduced.exceeded, unreproduced.acknowledged], [[], []])
	assert.match(unreproduced.unassessed[0].why, /not independently reproduced/)
})

test('a cross-shard screen decides nothing about an acknowledged group', () => {
	// The correction, and the case that produced it. The same group was reported -3.93%
	// inconclusive, then -6.40% regression with an interval of [-7.1%, -5.7%], then -3.44%
	// cleared. `cleared` and `regression` cannot both describe one quantity, so the between-run
	// variation exceeds the within-run interval — the between-runner fixed effect, demonstrated
	// by this list's own rot check. If that instrument cannot block a group, it cannot retire one.
	const screen = [group('warm/failure/all', 'cleared', -0.0344)]
	const result = evaluateAcceptedGroupRegressions(screen, { groups: [], singleRunner: false, measuredWhole: () => false }, acceptedFailureGroup)
	assert.deepEqual([result.stale, result.exceeded, result.acknowledged], [[], [], []])
	assert.match(result.unassessed[0].why, /no single-runner confirmation measured this group/)
})

test('a group entry is stale when a single-runner batch clears it, and unassessed when it cannot judge', () => {
	const screen = [group('warm/failure/all', 'regression', -0.064)]
	const stale = evaluateAcceptedGroupRegressions(screen, confirmedGroup('warm/failure/all', 'cleared', -0.004), acceptedFailureGroup)
	assert.deepEqual(stale.stale.map(record => record.group), ['warm/failure/all'])

	// An inconclusive confirmation neither confirms the accepted cost nor shows it gone.
	const undecided = evaluateAcceptedGroupRegressions(screen, confirmedGroup('warm/failure/all', 'inconclusive', -0.0393), acceptedFailureGroup)
	assert.deepEqual([undecided.acknowledged, undecided.exceeded, undecided.stale], [[], [], []])
	assert.match(undecided.unassessed[0].why, /reports it inconclusive/)

	// A confirmation that measured only part of the group cannot speak for the group.
	const partial = evaluateAcceptedGroupRegressions(screen, { groups: [group('warm/failure/all', 'cleared', -0.004)], singleRunner: true, measuredWhole: () => false }, acceptedFailureGroup)
	assert.deepEqual(partial.stale, [])
	assert.match(partial.unassessed[0].why, /did not measure every cell of the group/)
})

test('a group entry naming no group in the catalog is refused', () => {
	assert.deepEqual(unknownAcceptedGroupRegressions(catalog), [])
	assert.deepEqual(unknownAcceptedGroupRegressions([{ group: 'warm/success' }], acceptedFailureGroup), ['warm/failure/all'])
})

test('a group entry outliving its member cells is refused', () => {
	// The check a cell entry does not need. If the buffered path is optimized and the two cell
	// entries go, this entry must not survive them as a standing exemption for the group.
	assert.deepEqual(groupsWithoutAcknowledgedCells(catalog), [])
	assert.deepEqual(groupsWithoutAcknowledgedCells(catalog, acceptedFailureGroup, []), ['warm/failure/all'])
	assert.deepEqual(
		groupsWithoutAcknowledgedCells(catalog, acceptedFailureGroup, [{ cell: 'object/collect-all' }]),
		[],
		'any acknowledged member cell keeps the entry alive',
	)
})
