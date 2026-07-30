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

function row(scenario, screen, screenDelta, confirm = null, confirmDelta = null) {
	return { scenario, screen, screenDelta, confirm, confirmDelta }
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

test('a regression deeper than its bound still fails', () => {
	// The property that keeps this from being a suppression: -60% on an accepted cell is not
	// the accepted cost, and the message carries both numbers because "we accepted 45% and
	// measured 60%" is a different conversation from "this regressed".
	const { acknowledged, exceeded } = evaluateAcceptedRegressions([
		row('set/collect-all', 'severe', -0.6, 'severe', -0.58),
	])
	assert.deepEqual(acknowledged, [])
	assert.equal(exceeded.length, 1)
	assert.equal(exceeded[0].bound, 45)
	assert.equal(Number(exceeded[0].depthPercent.toFixed(1)), 60)
})

test('an entry whose cell the screen has cleared is stale', () => {
	// So the list shrinks as the code improves. Somebody optimizing the buffered path finds the
	// gate red until they delete the entry, which is the only reliable way a list like this ever
	// gets shorter.
	const { stale, acknowledged } = evaluateAcceptedRegressions([row('map/collect-all', 'cleared', -0.004)])
	assert.deepEqual(acknowledged, [])
	assert.deepEqual(stale.map(record => [record.cell, record.screen]), [['map/collect-all', 'cleared']])
	assert.deepEqual(evaluateAcceptedRegressions([row('set/collect-all', 'improvement', 0.2)]).stale.map(record => record.cell), ['set/collect-all'])
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
	assert.deepEqual(evaluateAcceptedRegressions([]), { acknowledged: [], exceeded: [], stale: [] })
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

function group(name, classification, delta) {
	return { group: name, classification, delta }
}

test('the committed group list is well formed and names the cells that carry the aggregate', () => {
	assert.deepEqual(malformedAcceptedGroupRegressions(), [])
	assert.deepEqual(acceptedGroupRegressions.map(entry => entry.group), ['warm/failure/all'])
	const [entry] = acceptedGroupRegressions
	assert.equal(entry.maxRegressionPercent, 12)
	// A reader checking a future breach has to be able to subtract the accepted contributions.
	assert.match(entry.because, /set\/collect-all` alone accounts for −4\.25pp/)
	assert.match(entry.because, /map\/collect-all` for −0\.88pp/)
})

test('a group aggregate inside its bound is acknowledged, and past it is not', () => {
	// `warm/failure/all` as CI measured it: -6.40%, interval [-7.1%, -5.7%], against a 12% bound.
	const within = evaluateAcceptedGroupRegressions([group('warm/failure/all', 'regression', -0.064)])
	assert.equal(within.acknowledged.length, 1)
	assert.equal(within.acknowledged[0].bound, 12)
	assert.equal(Number(within.acknowledged[0].depthPercent.toFixed(2)), 6.40)
	assert.deepEqual(within.exceeded, [])

	const past = evaluateAcceptedGroupRegressions([group('warm/failure/all', 'regression', -0.2)])
	assert.deepEqual(past.acknowledged, [])
	assert.equal(Number(past.exceeded[0].depthPercent.toFixed(1)), 20, 'a group effect roughly tripled still fails')
})

test('a group entry the screen has cleared is stale, and one it could not judge is untouched', () => {
	const stale = evaluateAcceptedGroupRegressions([group('warm/failure/all', 'cleared', -0.004)])
	assert.deepEqual(stale.stale.map(record => record.group), ['warm/failure/all'])
	// The previous comparison put this same group at -3.93% and called it inconclusive. A group the
	// run cannot judge is not evidence that the accepted cost is gone.
	const undecided = evaluateAcceptedGroupRegressions([group('warm/failure/all', 'inconclusive', -0.0393)])
	assert.deepEqual([undecided.acknowledged, undecided.exceeded, undecided.stale], [[], [], []])
})

test('a group entry naming no group in the catalog is refused', () => {
	assert.deepEqual(unknownAcceptedGroupRegressions(catalog), [])
	assert.deepEqual(unknownAcceptedGroupRegressions([{ group: 'warm/success' }]), ['warm/failure/all'])
})

test('a group entry outliving its member cells is refused', () => {
	// The check a cell entry does not need. If the buffered path is optimized and the two cell
	// entries go, this entry must not survive them as a standing exemption for the group.
	assert.deepEqual(groupsWithoutAcknowledgedCells(catalog), [])
	assert.deepEqual(groupsWithoutAcknowledgedCells(catalog, acceptedGroupRegressions, []), ['warm/failure/all'])
	assert.deepEqual(
		groupsWithoutAcknowledgedCells(catalog, acceptedGroupRegressions, [{ cell: 'object/collect-all' }]),
		[],
		'any acknowledged member cell keeps the entry alive',
	)
})
