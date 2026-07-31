/**
 * Reads the cells a step declares, against a built `packages/valchecker` dist.
 *
 * Every consumer of cells goes through this module — the catalog the selector reads,
 * the per-cell measurement worker, and `scripts/check-bench-cells.ts` — so all three
 * see one inventory produced one way. The hooks are registered at import time, before
 * any bench file is loaded, and every load below is a dynamic import for that reason.
 */

import { readdirSync, statSync } from 'node:fs'
import { register } from 'node:module'

register(new URL('./hooks.mjs', import.meta.url))

const repositoryRoot = new URL('../../../', import.meta.url)
const stepsRoot = new URL('packages/internal/src/steps/', repositoryRoot)
const helperUrl = new URL('packages/internal/src/test-utils/step-bench.ts', repositoryRoot).href

/** Every step's bench file, in code-point order of the step directory. */
export function stepBenchFiles() {
	const root = new URL(stepsRoot)
	return readdirSync(root)
		.filter(entry => statSync(new URL(`${entry}/`, root), { throwIfNoEntry: false })
			?.isDirectory() === true)
		.sort()
		.map(step => ({ step, url: new URL(`${step}/${step}.bench.ts`, root).href }))
		.filter(entry => statSync(new URL(entry.url), { throwIfNoEntry: false })
			?.isFile() === true)
}

/**
 * Imports the given bench files and returns what each declared.
 *
 * The step name a file passes to `stepBench()` is checked against the directory it sits
 * in. The two are separate facts — the selector attributes a changed source file to a
 * step by its `Meta.Name`, and then finds that step's cells by this name — so a file
 * declaring the wrong one would produce cells no diff can ever select.
 */
export async function collectStepBenches(files = stepBenchFiles()) {
	const { registeredStepBenches } = await import(helperUrl)
	const collected = []
	for (const { step, url } of files) {
		const before = registeredStepBenches().length
		await import(url)
		const added = registeredStepBenches()
			.slice(before)
		if (added.length === 0)
			throw new Error(`${url} declared no cells; a step bench file must call \`stepBench()\`.`)
		if (added.length > 1)
			throw new Error(`${url} called \`stepBench()\` ${added.length} times; one file declares one step's cells.`)
		const [registered] = added
		if (registered.step !== step) {
			throw new Error(
				`${url} declares cells for '${registered.step}' but sits in the '${step}' directory. `
				+ 'The selector attributes a changed file to a step and then looks up that step\'s cells by name, so a mismatch produces cells no diff can select.',
			)
		}
		collected.push({ step, url, cells: registered.cells })
	}
	return collected
}

/** Cells not in the impact gate: the local-only JavaScript comparisons. */
export function isGateCell(cell) {
	return cell.group !== 'baseline'
}

/**
 * The catalog, in the shape `scripts/impact-selection.ts` already consumes for
 * scenarios: an id, the group it aggregates into, and the steps a diff can reach it
 * through. A cell has exactly one step, which is the whole point of this phase — the
 * hand-maintained `steps: []` declaration a scenario carried was a claim about itself,
 * while a cell's step is the directory it lives in.
 */
export function cellCatalog(benches) {
	return benches.flatMap(({ step, cells }) => cells
		.filter(isGateCell)
		.map(cell => ({ id: cell.id, group: cell.group, steps: [step], batch: cell.batch, async: cell.async })))
}

function codesOf(result) {
	return [...new Set(result.issues.map(issue => issue.code))].sort()
}

/**
 * Runs one cell once, outside any timed region, and returns the reason it does not
 * match its declaration — or `null` when it does.
 *
 * This is the check that makes the cell contract enforceable rather than reviewed. A
 * cell claiming success that fails, and a failure cell whose issues come from a step
 * earlier in the chain, both look right in the source and are only visible here.
 */
export async function verifyCell(cell) {
	let result
	try {
		result = cell.async ? await cell.run() : cell.run()
	}
	catch (error) {
		return `threw ${error instanceof Error ? error.message : String(error)}`
	}

	if (cell.async && result != null && typeof result.then === 'function')
		return 'returned a promise after being awaited'
	if (!cell.async && result != null && typeof result.then === 'function')
		return 'returned a promise but is not declared `async: true`, so the timed region would measure promise creation'

	if ('constructs' in cell.expect) {
		return result != null && typeof result === 'object' && typeof result.execute === 'function'
			? null
			: 'expects to construct a schema, but produced something with no `execute` method'
	}

	if (result == null || typeof result !== 'object')
		return `produced ${String(result)}, which is not an execution result`

	if (cell.expect.success === true) {
		return 'value' in result
			? null
			: `expects success but failed with ${Array.isArray(result.issues)
				? codesOf(result)
						.join(', ')
				: 'no issues'}`
	}

	if (!Array.isArray(result.issues) || result.issues.length === 0)
		return 'expects a failure but succeeded'
	const produced = codesOf(result)
	const declared = [...new Set(cell.expect.issues)].sort()
	if (produced.join('|') !== declared.join('|'))
		return `expects the issue codes ${declared.join(', ')} but produced ${produced.join(', ')}`
	return null
}
