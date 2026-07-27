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

function executeFor(operation, durationMs) {
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

	const elapsedNs = Number(process.hrtime.bigint() - started)
	return {
		iterations,
		elapsedNs,
		opsPerSecond: iterations * 1e9 / elapsedNs,
		nanosecondsPerOperation: elapsedNs / iterations,
	}
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

export function measure(operation, mode) {
	const profile = getProfile(mode)

	executeFor(operation, profile.warmupMs)

	const samples = collectSamples(() => executeFor(operation, profile.sampleMs), profile)
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

export function getProfile(mode) {
	const profile = profiles[mode]
	if (!profile)
		throw new Error(`Unknown benchmark mode: ${mode}`)
	return profile
}
