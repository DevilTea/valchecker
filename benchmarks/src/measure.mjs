import process from 'node:process'
import { median, relativeMarginOfError } from './statistics.mjs'

/**
 * Sampling stops once the measurement is precise enough, instead of always
 * spending the maximum. Every cell used to take `maxSamples` regardless of how
 * it behaved, which spent the same budget on a cell that had already settled to
 * a 0.4% interval and on one still swinging by 12%.
 *
 * `targetRelativeMarginOfError` is 0.75%, chosen by replaying the 440 cells of
 * the 2026-07-27 full run. What that replay bounds is how far a reported ratio
 * moves: at most 1.22% for that run's sample order, and 1.34% when the same
 * samples are replayed in reverse order, against a 5% threshold for calling a
 * difference meaningful at all. Taking 61% of the samples costs a fifth of the
 * margin the harness already treats as noise.
 *
 * It does not bound scenario rankings, and a rule that appeared to would be
 * measuring ties rather than precision: 28 of the 345 adjacent ranking pairs in
 * that run are separated by less than 1.22%, so whether an ordering survives is
 * decided by which near-ties are in the data. A stricter 0.5% target changes one
 * ordering where 0.75% changes none.
 *
 * `minSamples` is 5 because 4 puts an 8% shift into a reported ratio — an
 * interval estimated from four samples is not yet describing the distribution.
 */
const profiles = {
	smoke: {
		warmupMs: 20,
		sampleMs: 30,
		minSamples: 3,
		maxSamples: 3,
		// Three samples cannot establish a 0.75% interval, so this profile asks for
		// no target instead of recording a failure to reach one. It exists to
		// exercise the pipeline, not to measure anything.
		targetRelativeMarginOfError: null,
	},
	standard: {
		warmupMs: 200,
		sampleMs: 300,
		minSamples: 5,
		maxSamples: 7,
		targetRelativeMarginOfError: 0.75,
	},
	full: {
		warmupMs: 500,
		sampleMs: 750,
		minSamples: 5,
		maxSamples: 12,
		targetRelativeMarginOfError: 0.75,
	},
}

// eslint-disable-next-line no-unused-vars, unused-imports/no-unused-vars -- write-only sink: assigning each result prevents V8 from dead-code-eliminating the benchmarked operation
let sink

function assertLogicalOperationsPerIteration(value) {
	if (!Number.isSafeInteger(value) || value < 1) {
		throw new TypeError(
			`logicalOperationsPerIteration must be a positive safe integer; received ${String(value)}.`,
		)
	}
}

function isThenable(value) {
	return value != null && typeof value.then === 'function'
}

function sampleOf(iterations, elapsedNs, logicalOperationsPerIteration = 1) {
	const logicalOperations = iterations * logicalOperationsPerIteration
	return {
		iterations,
		logicalOperations,
		elapsedNs,
		opsPerSecond: logicalOperations * 1e9 / elapsedNs,
		nanosecondsPerOperation: elapsedNs / logicalOperations,
	}
}

function executeFor(operation, durationMs, logicalOperationsPerIteration = 1) {
	const started = process.hrtime.bigint()
	const deadline = started + BigInt(Math.round(durationMs * 1e6))
	let iterations = 0
	let now = started

	do {
		sink = operation()
		iterations++
		if ((iterations & 15) === 0)
			now = process.hrtime.bigint()
	} while (now < deadline)

	return sampleOf(iterations, Number(process.hrtime.bigint() - started), logicalOperationsPerIteration)
}

/**
 * The asynchronous twin of `executeFor`, for an operation that returns a promise.
 *
 * The `await` is inside the timed region on purpose. A caller of an asynchronous
 * validation cannot avoid the microtask turn that delivers its result, so an
 * operation that resolves immediately still pays for one, and that cost is
 * exactly what an async row is comparing. Removing it would time the creation of
 * the promise and report that as validation throughput.
 *
 * Operations run strictly one at a time, so a sample measures the latency of a
 * complete validation rather than the throughput of an overlapped batch — the
 * same thing the synchronous loop measures, and the only version of it that a
 * per-operation number can describe.
 */
async function executeForAsync(operation, durationMs, logicalOperationsPerIteration = 1) {
	const started = process.hrtime.bigint()
	const deadline = started + BigInt(Math.round(durationMs * 1e6))
	let iterations = 0
	let now = started

	do {
		sink = await operation()
		iterations++
		if ((iterations & 15) === 0)
			now = process.hrtime.bigint()
	} while (now < deadline)

	return sampleOf(iterations, Number(process.hrtime.bigint() - started), logicalOperationsPerIteration)
}

/**
 * Whether the samples taken so far already establish the throughput to the
 * precision the profile asks for. Separate from the loop because it is the part
 * worth testing on its own: it can be checked against sequences chosen to sit on
 * either side of the target, which no timing-based test can do reliably.
 */
export function hasEnoughSamples(operationsPerSecond, profile) {
	return profile.targetRelativeMarginOfError !== null
		&& operationsPerSecond.length >= profile.minSamples
		&& relativeMarginOfError(operationsPerSecond) <= profile.targetRelativeMarginOfError
}

/**
 * The sampling loop, with the act of taking a sample passed in. Separating them
 * is what makes the loop testable: driven by a scripted sequence of samples it
 * behaves deterministically, whereas a test that drives it through real timing
 * can only assert whatever the machine happened to produce.
 */
export function collectSamples(takeSample, profile) {
	const samples = []
	const operationsPerSecond = []
	while (samples.length < profile.maxSamples) {
		const sample = takeSample()
		samples.push(sample)
		operationsPerSecond.push(sample.opsPerSecond)
		if (hasEnoughSamples(operationsPerSecond, profile))
			break
	}
	return samples
}

/**
 * The same loop for a sample that arrives as a promise. It is a mirror rather
 * than a shared implementation because a synchronous loop cannot await, and the
 * synchronous one is the hot path of every existing scenario. The stopping rule
 * itself is not duplicated — both call `hasEnoughSamples` — and the tests drive
 * both loops with the same scripted sequences and require identical results, so
 * a divergence fails rather than quietly measuring async cells to a different
 * standard.
 */
export async function collectSamplesAsync(takeSample, profile) {
	const samples = []
	const operationsPerSecond = []
	while (samples.length < profile.maxSamples) {
		const sample = await takeSample()
		samples.push(sample)
		operationsPerSecond.push(sample.opsPerSecond)
		if (hasEnoughSamples(operationsPerSecond, profile))
			break
	}
	return samples
}

/**
 * The reported fields, derived from the kept samples. Shared by both measurement
 * paths so that an async cell reports the same fields computed the same way as a
 * sync one; the only difference between the two paths is how a sample is taken.
 *
 * Exported for the same reason `collectSamples` is: driven by scripted samples it can
 * be checked against answers fixed by hand, where a test going through `measure` can
 * only assert that real timings are finite — which is true of the wrong number too.
 * `medianOpsPerSecond` is what the report ranks on and `reachedTarget` drives the `†`
 * marker, so neither can rest on that.
 */
export function summarize(samples, profile) {
	const ops = samples.map(sample => sample.opsPerSecond)
	const achievedRme = relativeMarginOfError(ops)

	return {
		samples,
		medianOpsPerSecond: median(ops),
		medianNanosecondsPerOperation: median(samples.map(sample => sample.nanosecondsPerOperation)),
		meanOpsPerSecond: ops.reduce((total, value) => total + value, 0) / ops.length,
		relativeMarginOfError: achievedRme,
		// Whether the profile's precision target was met. Null when the profile sets
		// no target, so a fixed-sample profile does not report a failure to reach
		// something it never asked for. The report marks the cells that missed it,
		// because a run mixes measurements of different precision and which ones
		// they are is not otherwise visible.
		reachedTarget: profile.targetRelativeMarginOfError === null
			? null
			: achievedRme <= profile.targetRelativeMarginOfError,
	}
}

export function measure(operation, mode, logicalOperationsPerIteration = 1) {
	const profile = getProfile(mode)
	assertLogicalOperationsPerIteration(logicalOperationsPerIteration)

	// The mirror of the probe in `measureAsync`, and the reason a wiring mistake
	// cannot publish a wrong number: an operation that returns a promise measured
	// here would time promise *creation*, which looks like an implausibly fast
	// validation rather than like an error. One call before the warmup, outside every
	// timed region, so nothing measured changes.
	if (isThenable(operation()))
		throw new TypeError('A synchronous measurement requires an operation that returns a value; received a promise. Measure it with `measureAsync`.')

	executeFor(operation, profile.warmupMs, logicalOperationsPerIteration)

	return summarize(collectSamples(() => executeFor(operation, profile.sampleMs, logicalOperationsPerIteration), profile), profile)
}

/**
 * Measures an operation that returns a promise. Same profile, same warmup, same
 * stopping rule, same reported fields as `measure`; the difference is that each
 * iteration awaits, which is what an async caller pays.
 *
 * The operation is probed once before any timing, because an operation that does
 * not return a thenable is not an asynchronous measurement: awaiting it would
 * produce a synchronous number under an async label. This is the harness-level
 * half of the guard — `scenarios/define.mjs` rejects the opposite mistake, a
 * promise-returning operation declared synchronous, when it verifies the
 * scenario's result.
 */
export async function measureAsync(operation, mode, logicalOperationsPerIteration = 1) {
	const profile = getProfile(mode)
	assertLogicalOperationsPerIteration(logicalOperationsPerIteration)

	const probe = operation()
	if (!isThenable(probe))
		throw new TypeError('An asynchronous measurement requires an operation that returns a promise; received a synchronous value.')
	await probe

	await executeForAsync(operation, profile.warmupMs, logicalOperationsPerIteration)

	return summarize(await collectSamplesAsync(() => executeForAsync(operation, profile.sampleMs, logicalOperationsPerIteration), profile), profile)
}

export function getProfile(mode) {
	const profile = profiles[mode]
	if (!profile)
		throw new Error(`Unknown benchmark mode: ${mode}`)
	return profile
}
