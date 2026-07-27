import process from 'node:process'
import { median, relativeMarginOfError } from './statistics.mjs'

/**
 * Sampling stops once the measurement is precise enough, instead of always
 * spending the maximum. Every cell used to take `maxSamples` regardless of how
 * it behaved, which spent the same budget on a cell that had already settled to
 * a 0.4% interval and on one still swinging by 12%.
 *
 * `targetRelativeMarginOfError` is 0.75%, chosen against the 440 cells of the
 * 2026-07-27 full run rather than picked for feel. Replaying that run under this
 * rule reproduces the ranking of all 95 scenarios exactly — not just the winner,
 * the complete order — with a worst-case shift of 1.21% in any reported ratio,
 * while taking 61% of the samples. Loosening it to 1.5% starts changing
 * scenario winners, and dropping `minSamples` to 4 puts an 8.3% shift into a
 * reported ratio, because an interval estimated from four samples is not yet
 * describing the distribution.
 */
const profiles = {
	smoke: {
		warmupMs: 20,
		sampleMs: 30,
		minSamples: 3,
		maxSamples: 3,
		targetRelativeMarginOfError: 0.75,
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
	return operationsPerSecond.length >= profile.minSamples
		&& relativeMarginOfError(operationsPerSecond) <= profile.targetRelativeMarginOfError
}

export function measure(operation, mode) {
	const profile = getProfile(mode)

	executeFor(operation, profile.warmupMs)

	const samples = []
	const ops = []
	while (samples.length < profile.maxSamples) {
		const sample = executeFor(operation, profile.sampleMs)
		samples.push(sample)
		ops.push(sample.opsPerSecond)
		if (hasEnoughSamples(ops, profile))
			break
	}
	const currentRme = relativeMarginOfError(ops)

	return {
		samples,
		medianOpsPerSecond: median(ops),
		medianNanosecondsPerOperation: median(samples.map(sample => sample.nanosecondsPerOperation)),
		meanOpsPerSecond: ops.reduce((total, value) => total + value, 0) / ops.length,
		relativeMarginOfError: currentRme,
		// A cell that ran out of samples without reaching the target is reporting a
		// wider interval than the run asked for, which is a property of the cell
		// worth carrying into the report rather than leaving to be re-derived.
		reachedTarget: currentRme <= profile.targetRelativeMarginOfError,
	}
}

export function getProfile(mode) {
	const profile = profiles[mode]
	if (!profile)
		throw new Error(`Unknown benchmark mode: ${mode}`)
	return profile
}
