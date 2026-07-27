import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getProfile, hasEnoughSamples, measure } from './measure.mjs'
import { criticalValue, relativeMarginOfError } from './statistics.mjs'

/**
 * The stopping rule decides how much evidence stands behind every published
 * number, so these check the two ways it can be wrong: stopping while the
 * measurement is still imprecise, and never stopping when it is precise.
 *
 * The rule is tested against chosen sequences rather than against a timed
 * operation. Even `() => 1`, the steadiest thing this harness can run, measures
 * a 0.8-1.3% interval at five 300 ms samples, so a timing-based test cannot put
 * the rule on a known side of a 0.75% target — it would assert how quiet the
 * machine was.
 */

const profile = { minSamples: 5, maxSamples: 12, targetRelativeMarginOfError: 0.75 }

test('identical samples satisfy the target, but not before the minimum', () => {
	const steady = Array.from({ length: 12 })
		.fill(1000)
	for (let count = 1; count < profile.minSamples; count++)
		assert.equal(hasEnoughSamples(steady.slice(0, count), profile), false, `${count} samples must never be enough`)
	assert.equal(hasEnoughSamples(steady.slice(0, profile.minSamples), profile), true)
})

test('a spread wider than the target is never enough', () => {
	const noisy = [1000, 1200, 800, 1150, 850, 1100, 900, 1050, 950, 1000, 1300, 700]
	assert.ok(relativeMarginOfError(noisy) > profile.targetRelativeMarginOfError)
	for (let count = profile.minSamples; count <= noisy.length; count++)
		assert.equal(hasEnoughSamples(noisy.slice(0, count), profile), false)
})

test('the rule tracks the target rather than a fixed spread', () => {
	// Just inside and just outside a 0.75% interval at five samples: t(4) = 2.776,
	// so the boundary sits at a standard deviation of 0.604% of the mean.
	const mean = 1000
	const inside = spreadAround(mean, 0.0060)
	const outside = spreadAround(mean, 0.0062)
	assert.equal(hasEnoughSamples(inside, profile), true)
	assert.equal(hasEnoughSamples(outside, profile), false)
})

/** Five values whose sample standard deviation is `fraction` of the mean. */
function spreadAround(mean, fraction) {
	// [-1, -1, 0, 1, 1] * step has a sample standard deviation of step, at n = 5.
	const step = mean * fraction
	return [mean - step, mean - step, mean, mean + step, mean + step]
}

test('measure honours the rule it is given', () => {
	const fullProfile = getProfile('full')
	const result = measure(() => 1, 'full')
	const ops = result.samples.map(sample => sample.opsPerSecond)
	assert.ok(result.samples.length >= fullProfile.minSamples)
	assert.ok(result.samples.length <= fullProfile.maxSamples)
	// It must have stopped at the first count the rule accepts, and at no earlier
	// count could the rule have accepted.
	for (let count = fullProfile.minSamples; count < result.samples.length; count++)
		assert.equal(hasEnoughSamples(ops.slice(0, count), fullProfile), false, `should have stopped at ${count}`)
	if (result.samples.length < fullProfile.maxSamples)
		assert.equal(hasEnoughSamples(ops, fullProfile), true)
	assert.equal(result.reachedTarget, result.relativeMarginOfError <= fullProfile.targetRelativeMarginOfError)
})

test('every sample is a real measurement', () => {
	const result = measure(() => 1, 'smoke')
	for (const sample of result.samples) {
		assert.ok(sample.iterations > 0)
		assert.ok(sample.elapsedNs > 0)
		assert.ok(Number.isFinite(sample.opsPerSecond) && sample.opsPerSecond > 0)
	}
	assert.ok(Number.isFinite(result.medianOpsPerSecond))
	assert.ok(Number.isFinite(result.medianNanosecondsPerOperation))
})

test('the reported interval uses Student t, not the normal quantile', () => {
	// A normal-quantile interval would be 1.96/2.776 = 71% of this one at five
	// samples, which is the understatement that made stopping early unsafe.
	const values = [100, 110, 90, 105, 95]
	const expected = 2.776 * Math.sqrt(62.5) / Math.sqrt(5) / 100 * 100
	assert.ok(Math.abs(relativeMarginOfError(values) - expected) < 1e-9)
	assert.equal(criticalValue(5), 2.776)
	assert.equal(criticalValue(12), 2.201)
	// Beyond the table the asymptotic value is correct to within 2%.
	assert.equal(criticalValue(200), 1.96)
})

test('a single sample is infinitely uncertain, not perfectly certain', () => {
	assert.equal(relativeMarginOfError([42]), Number.POSITIVE_INFINITY)
})
