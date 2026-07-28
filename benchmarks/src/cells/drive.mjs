/**
 * Drives every declared cell once and reports what it did, as JSON on stdout.
 *
 * This is the executable half of `scripts/check-bench-cells.ts`: the half that can only
 * be answered by running the cells against a build. It lives here rather than in the
 * gate script because it needs this directory's resolution hooks — a Node process whose
 * `vitest` is a shim and whose `'../..'` is the dist — and because the same collection
 * code then serves the gate, the catalog, and the measurement worker.
 *
 * It reports rather than decides. Which of these observations is a failure is
 * `check-bench-cells.ts`'s business, so the rules and their messages stay in one file.
 */

import process from 'node:process'
import { collectStepBenches, stepBenchFiles, verifyCell } from './collect.mjs'

/**
 * A rough per-unit cost, for the order-of-magnitude check on `batch` only.
 *
 * The minimum of several timings, not the mean: the question is whether the author
 * sized the batch to about 1–10 µs, and a loaded machine can only inflate a
 * measurement. The minimum is therefore the estimate that survives the load this gate
 * runs under, and it is still nothing like a benchmark — a number from here must never
 * be reported as a measurement.
 */
function estimateUnitNs(unit) {
	for (let warmup = 0; warmup < 3; warmup++)
		unit()
	const first = process.hrtime.bigint()
	unit()
	const single = Number(process.hrtime.bigint() - first)
	const units = single > 200_000 ? 1 : Math.max(1, Math.min(50, Math.round(100_000 / Math.max(single, 1))))
	let best = Number.POSITIVE_INFINITY
	for (let round = 0; round < 5; round++) {
		const started = process.hrtime.bigint()
		for (let index = 0; index < units; index++)
			unit()
		best = Math.min(best, Number(process.hrtime.bigint() - started) / units)
	}
	return best
}

async function report() {
	const benches = await collectStepBenches(stepBenchFiles())
	const cells = []

	for (const { step, url, cells: declared } of benches) {
		for (const cell of declared) {
			const failure = await verifyCell(cell)
			cells.push({
				id: cell.id,
				step,
				file: url,
				group: cell.group,
				batch: cell.batch,
				async: cell.async,
				expect: cell.expect,
				/** `null` when the cell did what it says it does. */
				verification: failure,
				// An async unit cannot be timed here without awaiting it, and the estimate is
				// only used for the batch-sizing check; async cells are left to review.
				unitNs: failure == null && !cell.async ? estimateUnitNs(cell.measuredUnit) : null,
			})
		}
	}

	return { steps: benches.map(({ step, url }) => ({ step, file: url })), cells }
}

// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM entry script executed to completion at load
process.stdout.write(JSON.stringify(await report()))
