import assert from 'node:assert/strict'
import { test } from 'node:test'
import { confirmationSelection, renderConfirmationMarkdown, resolveConfirmation } from './confirmation.mjs'

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
	const result = resolveConfirmation(screen, confirmOf([
		['map/collect-all', 'severe', -0.1159],
		['set/collect-all', 'severe', -0.302],
	]))
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

test('a severe group fails without confirmation, and says so', () => {
	// The documented limit: the confirmation set is chosen by the screen's outcome, so a
	// group aggregate over it would carry the conditioning the group estimator removes.
	// Confirming a group means re-measuring the group.
	const screen = screenOf([['a', 'cleared', -0.01]], { verdict: 'regression', severeGroups: ['warm/success'] })
	const result = resolveConfirmation(screen, confirmOf([]))
	assert.deepEqual(result.rows, [])
	assert.deepEqual(result.severeGroups, ['warm/success'])
	assert.equal(result.verdict, 'regression')
	assert.match(renderConfirmationMarkdown(result), /nothing to confirm/)
})

test('a clean screen needs no confirmation and keeps its own verdict', () => {
	for (const verdict of ['neutral', 'improvement', 'inconclusive']) {
		const screen = screenOf([['a', 'cleared', 0], ['b', 'inconclusive', 0.01, -0.02]], { verdict })
		const result = resolveConfirmation(screen, null)
		assert.deepEqual(result.rows, [])
		assert.equal(result.verdict, verdict, `${verdict} must survive a stage that had nothing to do`)
	}
})
