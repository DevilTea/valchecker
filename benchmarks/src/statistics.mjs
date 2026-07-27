/**
 * The one definition of "how uncertain is this measurement" used by both the
 * runner and the impact comparison. They disagreed before: the runner used the
 * normal quantile 1.96 while the comparison used Student's t, so the same set of
 * numbers produced two different intervals depending on which script read them.
 *
 * t is the correct choice here. The interval is built from the sample standard
 * deviation of a handful of samples, not from a known population variance, and
 * at these sample sizes the difference is not cosmetic: 1.96 understates a
 * 12-sample interval by 12% and a 5-sample interval by 42%. Understating it is
 * the direction that matters, because the runner now decides when it has
 * measured enough by comparing this value against a target.
 */

// Two-sided 95% Student t quantiles, keyed by sample count (df = count - 1).
const tCritical95 = new Map([
	[2, 12.706],
	[3, 4.303],
	[4, 3.182],
	[5, 2.776],
	[6, 2.571],
	[7, 2.447],
	[8, 2.365],
	[9, 2.306],
	[10, 2.262],
	[11, 2.228],
	[12, 2.201],
	[13, 2.179],
	[14, 2.160],
	[15, 2.145],
	[16, 2.131],
	[17, 2.120],
	[18, 2.110],
	[19, 2.101],
	[20, 2.093],
	[21, 2.086],
	[22, 2.080],
	[23, 2.074],
	[24, 2.069],
	[25, 2.064],
	[26, 2.060],
	[27, 2.056],
	[28, 2.052],
	[29, 2.048],
	[30, 2.045],
])

/**
 * Above 30 samples the t quantile is within 2% of the normal one, so the
 * asymptotic value is honest there rather than a silent fallback.
 */
export function criticalValue(sampleCount) {
	return tCritical95.get(sampleCount) ?? 1.96
}

export function mean(values) {
	return values.reduce((total, value) => total + value, 0) / values.length
}

export function median(values) {
	const sorted = [...values].sort((left, right) => left - right)
	const middle = Math.floor(sorted.length / 2)
	return sorted.length % 2 === 0
		? (sorted[middle - 1] + sorted[middle]) / 2
		: sorted[middle]
}

/**
 * Half-width of the 95% confidence interval of the mean, as a percentage of the
 * mean. A single sample has no spread to estimate, so it is reported as
 * infinitely uncertain rather than as perfectly certain.
 */
export function relativeMarginOfError(values) {
	if (values.length < 2)
		return Number.POSITIVE_INFINITY
	const average = mean(values)
	if (average === 0)
		return 0
	const variance = values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1)
	return criticalValue(values.length) * Math.sqrt(variance) / Math.sqrt(values.length) / Math.abs(average) * 100
}
