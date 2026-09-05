import assert from 'node:assert/strict'
import { test } from 'node:test'
import { collectSamples, collectSamplesAsync, getProfile, hasEnoughSamples, measure, measureAsync, summarize } from './measure.mjs'
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
 *
 * The asynchronous path is held to the same standard, plus one rule of its own:
 * every stopping-rule assertion about it is a *parity* assertion against the
 * synchronous loop over the same scripted samples. The two loops cannot share an
 * implementation, so what keeps them from drifting is that a difference in the
 * count they keep, or in which samples they keep, fails here.
 */

const fullProfile = getProfile('full')

function sampleOf(opsPerSecond) {
	return { iterations: 1000, logicalOperations: 1000, elapsedNs: 1e9, opsPerSecond, nanosecondsPerOperation: 1e9 / opsPerSecond }
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

/**
 * Calls a measurement makes that no sample accounts for, other than the warmup:
 * both paths call the operation once before any timing, to check it is the kind
 * of operation they measure. Subtracting it is what stops `calls > sampled` from
 * passing with the warmup removed.
 */
const unsampledProbeCalls = 1

test('measure warms up before it samples', () => {
	// Deriving a floor from the profile's warmup share looks tighter and is not:
	// warmup runs before the code is hot, so it completes proportionally fewer
	// iterations on a slow machine than its share of the time budget. That
	// version passed here and failed on CI at 9% of a 22% expectation. Warmup
	// either ran or it did not, and counting is enough to tell — with the probe
	// subtracted, removing the warmup leaves the two counts exactly equal.
	let calls = 0
	const result = measure(() => {
		calls++
		return 1
	}, 'smoke')
	const sampled = result.samples.reduce((total, sample) => total + sample.iterations, 0)
	assert.ok(
		calls > sampled + unsampledProbeCalls,
		`no warmup: ${calls} calls for ${sampled} sampled iterations plus ${unsampledProbeCalls} probe`,
	)
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

/**
 * The reported fields. Everything downstream reads these rather than the samples:
 * `medianOpsPerSecond` is what every ranking, ratio, and geometric mean in the report
 * is computed from, and `reachedTarget` is what marks a measurement that never reached
 * the profile's precision. A test that only asserts they are finite accepts the first
 * sample, the mean, or a constant in place of any of them, so these drive `summarize`
 * with scripted samples whose answers are written out by hand.
 */

/** Three samples whose median, first value, and mean are three different numbers. */
const scriptedSummary = [
	{ iterations: 100, logicalOperations: 100, elapsedNs: 1e8, opsPerSecond: 1000, nanosecondsPerOperation: 50 },
	{ iterations: 100, logicalOperations: 100, elapsedNs: 1e8, opsPerSecond: 3000, nanosecondsPerOperation: 10 },
	{ iterations: 100, logicalOperations: 100, elapsedNs: 1e8, opsPerSecond: 2600, nanosecondsPerOperation: 20 },
]

test('the reported throughput is the median sample, not the first or the mean', () => {
	// Sorted: 1000, 2600, 3000 — median 2600. The first sample is 1000 and the mean is
	// (1000 + 3000 + 2600) / 3 = 2200, so all three answers are distinguishable.
	const summary = summarize(scriptedSummary, fullProfile)
	assert.equal(summary.medianOpsPerSecond, 2600)
	assert.equal(summary.meanOpsPerSecond, 2200)
	assert.deepEqual(summary.samples, scriptedSummary)
})

test('the reported nanoseconds are the median of the sampled nanoseconds', () => {
	// Sorted: 10, 20, 50 — median 20, where the first sample says 50. The values are
	// deliberately not 1e9 divided by the throughputs above (which would be 1,000,000,
	// 333,333 and 384,615), so a summary that derived this field from the throughput
	// median instead of from its own samples is also caught.
	assert.equal(summarize(scriptedSummary, fullProfile).medianNanosecondsPerOperation, 20)
})

test('a measurement that missed the profile target says so', () => {
	// The three scripted samples have a mean of 2200 and a sample standard deviation of
	// 1058.3, which is 48% of the mean — far outside the 0.75% target — so this cannot be
	// reported as having reached it. `reachedTarget` is what puts the `†` marker on a row.
	assert.equal(summarize(scriptedSummary, fullProfile).reachedTarget, false)
	// And the other direction, from five identical samples: nothing is more precise than
	// zero spread, so a rule that never reports success is caught too.
	const steady = Array.from({ length: fullProfile.minSamples }, () => sampleOf(1000))
	assert.equal(summarize(steady, fullProfile).reachedTarget, true)
	assert.equal(summarize(steady, fullProfile).medianOpsPerSecond, 1000)
})

/**
 * The asynchronous measurement path. `measureAsync` awaits each operation inside
 * the timed region, which is the cost an asynchronous caller actually pays, and
 * everything else about it — profile, warmup, stopping rule, reported fields —
 * must be the synchronous path's behaviour rather than a second standard.
 */

function scripted(values) {
	let index = 0
	return () => sampleOf(values[index++])
}

/** Three sequences chosen so the loop stops for a different reason in each. */
const scriptedSequences = [
	// Identical: satisfies the target at the floor and never spends more.
	Array.from({ length: fullProfile.maxSamples + 3 })
		.fill(1000),
	// Never inside the target, so the cap is what stops it.
	quietTail(fullProfile.maxSamples + 3),
	// Outside the target at five samples and inside it at six: t(4) = 2.776 puts
	// 0.62% of the mean at 0.770%, while the sixth identical value drops the sample
	// standard deviation to 0.62% × √(4/5) = 0.5546% and t(5) = 2.571 puts that at
	// 0.582%. Nothing here is computed with the loop under test.
	[...spreadAround(1000, 0.0062), 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000],
]

function collectAsyncFrom(values) {
	const takeSample = scripted(values)
	return collectSamplesAsync(async () => takeSample(), fullProfile)
}

test('the async sampling loop keeps exactly the samples the sync loop keeps', async () => {
	for (const values of scriptedSequences) {
		// Each loop drives its own copy of the same script, so what is compared is the
		// two loops rather than one shared closure.
		const asynchronous = await collectAsyncFrom(values)
		const label = values.slice(0, 6)
			.join()
		assert.deepEqual(asynchronous, collectSamples(scripted(values), fullProfile), `${label}…`)
	}
})

test('the async loop stops at the counts the scripted sequences fix', async () => {
	const [steady, never, sixth] = scriptedSequences
	assert.equal((await collectAsyncFrom(steady)).length, fullProfile.minSamples)
	assert.equal((await collectAsyncFrom(never)).length, fullProfile.maxSamples)
	assert.equal((await collectAsyncFrom(sixth)).length, fullProfile.minSamples + 1)
})

test('measureAsync warms up before it samples', async () => {
	let calls = 0
	const result = await measureAsync(async () => {
		calls++
		return 1
	}, 'smoke')
	const sampled = result.samples.reduce((total, sample) => total + sample.iterations, 0)
	assert.ok(
		calls > sampled + unsampledProbeCalls,
		`no warmup: ${calls} calls for ${sampled} sampled iterations plus ${unsampledProbeCalls} probe`,
	)
})

test('measureAsync reports exactly the fields measure reports', async () => {
	const synchronous = measure(() => 1, 'smoke')
	const asynchronous = await measureAsync(async () => 1, 'smoke')
	assert.deepEqual(Object.keys(asynchronous), Object.keys(synchronous))
	assert.deepEqual(Object.keys(asynchronous.samples[0]), Object.keys(synchronous.samples[0]))
	assert.equal(asynchronous.reachedTarget, null)
	assert.ok(asynchronous.samples.length >= 1)
	for (const sample of asynchronous.samples) {
		assert.ok(sample.iterations > 0)
		assert.ok(sample.elapsedNs > 0)
		assert.ok(Number.isFinite(sample.opsPerSecond) && sample.opsPerSecond > 0)
	}
	assert.ok(Number.isFinite(asynchronous.medianNanosecondsPerOperation))
})

test('the await is inside the timed region', async () => {
	// An operation that cannot complete in under a millisecond must not report a
	// per-operation cost below one. This is the mutation that matters most on this
	// path: a loop that started the operation without awaiting it would time promise
	// creation — hundreds of nanoseconds — and publish it as validation throughput.
	const blocker = new Int32Array(new SharedArrayBuffer(4))
	const result = await measureAsync(() => Promise.resolve()
		.then(() => {
			Atomics.wait(blocker, 0, 0, 1)
		}), 'smoke')
	assert.ok(
		result.medianNanosecondsPerOperation > 500_000,
		`${result.medianNanosecondsPerOperation.toFixed(0)} ns/op for an operation that takes at least a millisecond`,
	)
})

test('measure refuses an operation that is asynchronous', () => {
	// The wiring guard: an async operation handed to the synchronous path would be
	// timed as promise creation and published as validation throughput, which is a
	// plausible-looking number rather than a visible failure.
	assert.throws(() => measure(async () => 1, 'smoke'), /received a promise/)
	assert.throws(() => measure(() => ({ then: () => {} }), 'smoke'), /received a promise/)
})

test('measureAsync refuses an operation that is not asynchronous', async () => {
	// Awaiting a non-thenable succeeds silently and would report a synchronous
	// number under an async label, so this is rejected before any timing.
	await assert.rejects(() => measureAsync(() => 1, 'smoke'), /requires an operation that returns a promise/)
	await assert.rejects(() => measureAsync(() => ({ value: 'abc' }), 'smoke'), /requires an operation that returns a promise/)
})

test('a batched measured iteration reports logical operations rather than wrapper calls', () => {
	const batch = 200
	const result = measure(() => 1, 'smoke', batch)
	for (const sample of result.samples) {
		assert.equal(sample.logicalOperations, sample.iterations * batch)
		assert.equal(sample.opsPerSecond, sample.logicalOperations * 1e9 / sample.elapsedNs)
		assert.equal(sample.nanosecondsPerOperation, sample.elapsedNs / sample.logicalOperations)
	}
})

test('the async path applies the same logical-operation normalization', async () => {
	const batch = 20
	const result = await measureAsync(async () => 1, 'smoke', batch)
	for (const sample of result.samples)
		assert.equal(sample.logicalOperations, sample.iterations * batch)
})

test('a measurement refuses an invalid logical-operation multiplier', async () => {
	for (const invalid of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
		assert.throws(() => measure(() => 1, 'smoke', invalid), /positive safe integer/)
		await assert.rejects(() => measureAsync(async () => 1, 'smoke', invalid), /positive safe integer/)
	}
})
