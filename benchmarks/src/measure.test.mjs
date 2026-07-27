import assert from 'node:assert/strict'
import { test } from 'node:test'
import { collectSamples, getProfile, hasEnoughSamples, measure } from './measure.mjs'
import { criticalValue, relativeMarginOfError } from './statistics.mjs'

/**
 * The stopping rule decides how much evidence stands behind every published
 * number, so these check the ways it can be wrong: stopping while the
 * measurement is still imprecise, never stopping when it is precise, skipping
 * the warmup that makes the samples comparable, and shipping a profile whose
 * floor is lower than the evidence supports.
 *
 * Two rules are followed throughout. The profiles under test are the shipped
 * ones from `getProfile`, never a copy written here — a copy leaves the shipped
 * constants uncovered, so lowering `minSamples` would pass. And the expected
 * answers are fixed by construction from chosen sequences, never recomputed with
 * the function under test — recomputing is self-consistent and would accept a
 * rule that looks at the wrong samples.
 */

const fullProfile = getProfile('full')

function sampleOf(opsPerSecond) {
	return { iterations: 1000, elapsedNs: 1e9, opsPerSecond, nanosecondsPerOperation: 1e9 / opsPerSecond }
}

/** Wide overall, but with a run of identical values at the end. */
function quietTail(length) {
	const values = Array.from({ length })
		.fill(1000)
	values[1] = 1400
	values[2] = 600
	return values
}

test('every shipped profile is internally consistent', () => {
	for (const mode of ['smoke', 'standard', 'full']) {
		const profile = getProfile(mode)
		assert.ok(profile.warmupMs > 0, `${mode} must warm up`)
		assert.ok(profile.sampleMs > 0, `${mode} must sample`)
		assert.ok(profile.minSamples >= 2, `${mode} cannot estimate a spread from one sample`)
		assert.ok(profile.maxSamples >= profile.minSamples, `${mode} caps below its floor`)
		if (profile.targetRelativeMarginOfError !== null)
			assert.ok(profile.targetRelativeMarginOfError > 0, `${mode} target must be positive`)
	}
})

test('the measuring profiles keep the five-sample floor', () => {
	// Four samples put an 8% shift into a reported ratio when the rule was
	// replayed against real data, so this floor is evidence, not taste.
	for (const mode of ['standard', 'full'])
		assert.ok(getProfile(mode).minSamples >= 5, `${mode} floor is below the replayed evidence`)
})

test('identical samples satisfy the target, but not before the minimum', () => {
	const steady = Array.from({ length: fullProfile.maxSamples })
		.fill(1000)
	for (let count = 1; count < fullProfile.minSamples; count++)
		assert.equal(hasEnoughSamples(steady.slice(0, count), fullProfile), false, `${count} samples must never be enough`)
	assert.equal(hasEnoughSamples(steady.slice(0, fullProfile.minSamples), fullProfile), true)
})

test('a spread wider than the target is never enough, however it is distributed', () => {
	// Both series stay outside the target at every count. The second ends with a
	// run of identical values, so a rule that looked only at recent samples would
	// accept it — the whole series is what the interval describes.
	for (const series of [[1000, 1200, 800, 1150, 850, 1100, 900, 1050, 950, 1000, 1300, 700], quietTail(fullProfile.maxSamples)]) {
		assert.ok(relativeMarginOfError(series) > fullProfile.targetRelativeMarginOfError)
		for (let count = fullProfile.minSamples; count <= series.length; count++)
			assert.equal(hasEnoughSamples(series.slice(0, count), fullProfile), false, `accepted ${count} of ${series.join()}`)
	}
})

test('the rule tracks the target rather than a fixed spread', () => {
	// Just inside and just outside a 0.75% interval at five samples: t(4) = 2.776,
	// so the boundary sits at a standard deviation of 0.604% of the mean.
	assert.equal(hasEnoughSamples(spreadAround(1000, 0.0060), fullProfile), true)
	assert.equal(hasEnoughSamples(spreadAround(1000, 0.0062), fullProfile), false)
})

/** Five values whose sample standard deviation is `fraction` of the mean. */
function spreadAround(mean, fraction) {
	// [-1, -1, 0, 1, 1] * step has a sample standard deviation of step, at n = 5.
	const step = mean * fraction
	return [mean - step, mean - step, mean, mean + step, mean + step]
}

test('a profile with no target never stops early', () => {
	const fixed = { minSamples: 3, maxSamples: 3, targetRelativeMarginOfError: null }
	assert.equal(hasEnoughSamples([1000, 1000, 1000], fixed), false)
	assert.equal(measure(() => 1, 'smoke').reachedTarget, null)
})

test('the sampling loop stops at the first count that meets the target', () => {
	let taken = 0
	const samples = collectSamples(() => {
		taken++
		return sampleOf(1000)
	}, fullProfile)
	assert.equal(samples.length, fullProfile.minSamples)
	assert.equal(taken, fullProfile.minSamples, 'took a sample it did not keep')
})

test('the sampling loop spends the maximum when the target is never met', () => {
	const scripted = quietTail(fullProfile.maxSamples + 3)
	let index = 0
	const samples = collectSamples(() => sampleOf(scripted[index++]), fullProfile)
	assert.equal(samples.length, fullProfile.maxSamples)
})

test('measure warms up before it samples', () => {
	// `executeFor` calls the operation once per iteration and reports the count, so
	// calls beyond the ones the kept samples account for are the warmup's.
	let calls = 0
	const result = measure(() => {
		calls++
		return 1
	}, 'smoke')
	const sampled = result.samples.reduce((total, sample) => total + sample.iterations, 0)
	assert.ok(calls > sampled, `no warmup: ${calls} calls for ${sampled} sampled iterations`)
})

test('every sample is a real measurement', () => {
	const result = measure(() => 1, 'smoke')
	assert.ok(result.samples.length >= 1)
	for (const sample of result.samples) {
		assert.ok(sample.iterations > 0)
		assert.ok(sample.elapsedNs > 0)
		assert.ok(Number.isFinite(sample.opsPerSecond) && sample.opsPerSecond > 0)
	}
	assert.ok(Number.isFinite(result.medianOpsPerSecond))
	assert.ok(Number.isFinite(result.medianNanosecondsPerOperation))
	assert.ok(Number.isFinite(result.relativeMarginOfError))
})

test('the reported interval uses Student t, not the normal quantile', () => {
	// A normal-quantile interval would be 1.96/2.776 = 71% of this one at five
	// samples, which is the understatement that made stopping early unsafe.
	const values = [100, 110, 90, 105, 95]
	const expected = 2.776 * Math.sqrt(62.5) / Math.sqrt(5) / 100 * 100
	assert.ok(Math.abs(relativeMarginOfError(values) - expected) < 1e-9)
	assert.equal(criticalValue(5), 2.776)
	assert.equal(criticalValue(12), 2.201)
})

test('past the table the quantile is computed, not replaced by the normal one', () => {
	// Exact two-sided 95% t quantiles, computed independently from the incomplete
	// beta function. The normal quantile 1.96 is 4.2% below the first of these,
	// which is why it is not the continuation.
	for (const [sampleCount, exact] of [[31, 2.042272], [40, 2.022691], [60, 2.000995], [100, 1.984217], [1000, 1.962341]]) {
		const error = Math.abs(criticalValue(sampleCount) - exact) / exact * 100
		assert.ok(error < 0.01, `n=${sampleCount}: ${criticalValue(sampleCount)} is ${error.toFixed(3)}% from ${exact}`)
	}
	assert.ok(criticalValue(31) > 2, 'the continuation must not collapse to the normal quantile')
})

test('a single sample is infinitely uncertain, not perfectly certain', () => {
	assert.equal(relativeMarginOfError([42]), Number.POSITIVE_INFINITY)
})
