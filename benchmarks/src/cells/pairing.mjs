/**
 * The temporal order of a paired impact measurement.
 *
 * Pairing is per cell, not per whole side: every baseline/candidate observation for one
 * cell is adjacent, and repetition parity reverses which side goes first. That keeps a
 * monotonic drift from landing systematically on either side without separating one
 * pair by the rest of the shard.
 */
export function pairedSideOrder(repetition) {
	if (!Number.isSafeInteger(repetition) || repetition < 1)
		throw new TypeError(`repetition must be a positive safe integer; received ${String(repetition)}`)
	return repetition % 2 === 0 ? ['baseline', 'candidate'] : ['candidate', 'baseline']
}

export function pairedCellRuns(cells, repetition) {
	const sides = pairedSideOrder(repetition)
	return cells.flatMap(cell => sides.map(side => ({ cell, side })))
}
