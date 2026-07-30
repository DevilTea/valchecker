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

const normalQuantile95 = 1.959964

/**
 * Past the table the quantile is computed rather than approximated by the normal
 * one. Falling back to 1.959964 looked harmless and is not: at 31 samples the
 * true quantile is 2.0423, so the fallback would understate the interval by 4.2%
 * — the same kind of understatement this module exists to remove — and it takes
 * about 100 samples before the error drops under 2%.
 *
 * Two Cornish-Fisher correction terms bring it within 0.01% of the true quantile
 * from 31 samples upward, which `measure.test.mjs` checks against an
 * independently computed t distribution.
 */
export function criticalValue(sampleCount) {
	const tabulated = tCritical95.get(sampleCount)
	if (tabulated !== undefined)
		return tabulated
	const degreesOfFreedom = sampleCount - 1
	const z = normalQuantile95
	return z
		+ (z ** 3 + z) / (4 * degreesOfFreedom)
		+ (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * degreesOfFreedom ** 2)
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
 * Half-width of the 95% confidence interval of the mean, in the units of the
 * values. A single sample has no spread to estimate, so it is reported as
 * infinitely uncertain rather than as perfectly certain.
 *
 * This is the primitive; the relative form below divides it by the mean. Keeping
 * them apart matters because the paired estimator works in log space, where the
 * mean is near zero for a change of nothing and a *relative* half-width would be
 * unbounded on exactly the measurements that are most certain.
 */
export function confidenceHalfWidth(values) {
	if (values.length < 2)
		return Number.POSITIVE_INFINITY
	const average = mean(values)
	const variance = values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1)
	return criticalValue(values.length) * Math.sqrt(variance) / Math.sqrt(values.length)
}

/**
 * Half-width of the 95% confidence interval of the mean, as a percentage of the
 * mean.
 */
export function relativeMarginOfError(values) {
	if (values.length < 2)
		return Number.POSITIVE_INFINITY
	const average = mean(values)
	if (average === 0)
		return 0
	return confidenceHalfWidth(values) / Math.abs(average) * 100
}

/**
 * The one paired estimator: the mean of per-repetition **log ratios**, its
 * Student-t interval, and both converted back to ratios.
 *
 * The comparison used to carry two estimands at once — an interval centred on the
 * mean of the paired ratios, and a point estimate that was their median — so the
 * number a reader saw was not the number the interval was about, and a row could
 * in principle be classified against one while being reported as the other. One
 * decision needs one estimator.
 *
 * Why the log ratio is the one to keep. A ratio is not symmetric in the thing being
 * measured: a candidate twice as fast is 2.0 and a candidate half as fast is 0.5,
 * so an arithmetic mean of ratios and an interval built from their spread both
 * lean toward improvements. In logs the two are +ln 2 and −ln 2, the mean of logs
 * is the log of the geometric mean, and `exp` of it is the ratio to report. It also
 * composes: the group aggregate is a mean of these same numbers, which is why the
 * group can be an estimator of its own rather than a summary of decided rows.
 *
 * Student's t stays, for the reason this module exists: five repetitions estimate
 * their own spread, and the normal quantile understates a five-sample interval by
 * 42%. The correction here is coherence, not another threshold.
 */
export function pairedLogRatioEstimate(ratios) {
	const logRatios = ratios.map(Math.log)
	const logMean = mean(logRatios)
	const halfWidth = confidenceHalfWidth(logRatios)
	return {
		logRatios,
		logMean,
		/** Half-width of the log interval, which is a relative half-width already. */
		halfWidth,
		ratio: Math.exp(logMean),
		ratioLow: Math.exp(logMean - halfWidth),
		ratioHigh: Math.exp(logMean + halfWidth),
	}
}
