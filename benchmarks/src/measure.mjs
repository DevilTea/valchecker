const profiles = {
	smoke: {
		warmupMs: 20,
		sampleMs: 30,
		samples: 3,
	},
	standard: {
		warmupMs: 200,
		sampleMs: 300,
		samples: 7,
	},
	full: {
		warmupMs: 500,
		sampleMs: 750,
		samples: 12,
	},
}

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

function median(values) {
	const sorted = [...values].sort((a, b) => a - b)
	const middle = Math.floor(sorted.length / 2)
	return sorted.length % 2 === 0
		? (sorted[middle - 1] + sorted[middle]) / 2
		: sorted[middle]
}

function mean(values) {
	return values.reduce((total, value) => total + value, 0) / values.length
}

function standardDeviation(values) {
	const average = mean(values)
	const variance = values.reduce((total, value) => total + (value - average) ** 2, 0) / Math.max(1, values.length - 1)
	return Math.sqrt(variance)
}

export function measure(operation, mode) {
	const profile = profiles[mode]
	if (!profile)
		throw new Error(`Unknown benchmark mode: ${mode}`)

	executeFor(operation, profile.warmupMs)
	const samples = Array.from({ length: profile.samples }, () => executeFor(operation, profile.sampleMs))
	const ops = samples.map(sample => sample.opsPerSecond)
	const average = mean(ops)
	const deviation = standardDeviation(ops)
	const relativeMarginOfError = average === 0
		? 0
		: 1.96 * deviation / Math.sqrt(ops.length) / average * 100

	return {
		samples,
		medianOpsPerSecond: median(ops),
		medianNanosecondsPerOperation: median(samples.map(sample => sample.nanosecondsPerOperation)),
		meanOpsPerSecond: average,
		relativeMarginOfError,
	}
}

export function getProfile(mode) {
	const profile = profiles[mode]
	if (!profile)
		throw new Error(`Unknown benchmark mode: ${mode}`)
	return profile
}
