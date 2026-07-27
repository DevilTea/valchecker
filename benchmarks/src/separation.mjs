/**
 * When is a difference between two measurements large enough for the report to
 * present it as an ordering?
 *
 * Not when their confidence intervals stop overlapping. Those intervals describe
 * spread within one run, and the question a reader asks of a ranking is whether
 * it would come out the same way again. Comparing four `full` runs from
 * 2026-07-26 and 2026-07-27 (30215300967, 30227011273, 30240750699,
 * 30256809269), 74 of the 840 adapter pairs present in all four changed their
 * ordering at least once, and interval overlap was a worse predictor of which
 * ones than a flat gap: at the operating point that catches three quarters of
 * them, overlap wrongly flagged 26 settled pairs and a flat gap only 18.
 *
 * So it is a flat gap, and 5% is both what the evidence supports and what the
 * harness already means by a meaningful difference — `compare.mjs` uses the same
 * number to decide whether a before/after change is worth reporting. At 5% the
 * rule marks 55 of the 74 unreproducible orderings and 18 of the 766 settled
 * ones.
 *
 * What it cannot do: the remaining 19 unreproducible orderings involve gaps
 * larger than 5%, mostly on cells whose own measurements are unstable. A row
 * without the marker is not thereby proven reproducible; it is only not close
 * enough to be obviously unreproducible. Marking ties makes the unmarked rows
 * look settled, which is why that limit belongs in the report itself.
 */
export const separationThresholdPercent = 5

/**
 * Whether `faster` stands apart from `slower`, both as operations per second.
 * Deliberately not symmetric in its arguments: the caller has already ordered
 * them, and the gap is expressed against the slower one.
 */
export function isSeparated(faster, slower) {
	if (!(slower > 0))
		return false
	return (faster - slower) / slower * 100 >= separationThresholdPercent
}
