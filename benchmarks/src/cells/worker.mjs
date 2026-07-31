/**
 * Measures exactly one cell, in a process of its own, and prints the row.
 *
 * One process per cell is the same isolation the cross-library suite settled on, and for
 * the same measured reason: under one process per adapter an identical array pipeline
 * measured 83.5 ns as the first array-carried scenario and 261.9 ns after three others.
 * A gate whose numbers depend on what ran before them cannot attribute a change to a diff.
 *
 * The cell is loaded from its own step's bench file rather than from all of them, so a
 * process pays for one file plus the dist it measures.
 */

import process from 'node:process'
import { measure, measureAsync } from '../measure.mjs'
import { collectStepBenches, stepBenchFiles, verifyCell } from './collect.mjs'

async function main() {
	const [cellId, mode = 'standard'] = process.argv.slice(2)
	if (!cellId)
		throw new Error('Usage: worker.mjs <step/cell> [mode]')

	const [step] = cellId.split('/')
	const file = stepBenchFiles()
		.find(entry => entry.step === step)
	if (!file)
		throw new Error(`No bench file for '${step}', named by the cell '${cellId}'`)

	const [bench] = await collectStepBenches([file])
	const cell = bench.cells.find(candidate => candidate.id === cellId)
	if (!cell) {
		throw new Error(`'${step}' declares no cell '${cellId}'. Its cells are ${bench.cells.map(candidate => candidate.id)
			.join(', ')}`)
	}

	// Verified here as well as in `pnpm bench:cells`, because the two answer different
	// questions. The gate asks whether the cell is correct in the checked-out tree; this asks
	// whether it is correct against *this* build, which is the one being measured. A cell that
	// cannot execute against the baseline build is how a new step announces itself, and the
	// run reports it as unmeasurable rather than failing or passing in silence.
	const failure = await verifyCell(cell)
	if (failure != null)
		return { cell: cellId, unmeasurable: failure }

	const failing = cell.expect.success === false
	return {
		cell: cellId,
		unmeasurable: null,
		result: {
			scenario: cellId,
			// The metadata `impact-verdict.mjs` compares and aggregates over, derived from the
			// cell rather than declared a second time beside it.
			category: cell.group.startsWith('warm') ? 'warm' : cell.group,
			group: cell.group,
			resultKind: failing ? 'failure' : 'success',
			issuePolicy: cell.group === 'warm/failure/all' ? 'all' : failing ? 'library-default' : 'not-applicable',
			comparisonScope: 'equivalent',
			diagnosticIssueCount: cell.expect.issues?.length ?? null,
			executionMode: cell.async ? 'async' : 'sync',
			entry: 'native',
			batch: cell.batch,
			...(cell.async ? await measureAsync(cell.measuredUnit, mode) : measure(cell.measuredUnit, mode)),
		},
	}
}

// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM entry script executed to completion at load
process.stdout.write(JSON.stringify(await main()))
