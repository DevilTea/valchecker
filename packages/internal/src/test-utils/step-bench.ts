/**
 * What a step's `<name>.bench.ts` declares, and why one declaration can serve two
 * drivers.
 *
 * A step's benchmark has two readers with incompatible requirements:
 *
 * - `pnpm bench` is `vitest bench` over `**` /`*.bench.ts`, running against the
 *   TypeScript **source** through the `../..` import every bench file already has.
 *   It is the local loop: fast, filterable by path, no build required.
 * - the **Performance Impact** gate compares two builds of
 *   `packages/valchecker/dist/index.mjs`, one process per cell, paired repetitions,
 *   through `benchmarks/src/`. A vitest `bench()` over source measures neither of
 *   those builds and produces no paired ratio.
 *
 * The resolution is that a bench file declares *cells as data* and this module turns
 * them into `bench()` calls. The local driver is vitest, which sees exactly those
 * calls. The gate driver is `benchmarks/src/cells/`, which imports the same file in a
 * plain Node process under two resolution hooks: `vitest` resolves to a shim, and the
 * package entry `../..` resolves to the dist build under test. It then reads `cells`
 * out of the registry below rather than from the `bench()` calls, because a cell needs
 * more than a name and a closure — the group it aggregates into, what executing it
 * must produce, and how many iterations make up one measured unit.
 *
 * So there is one declaration and no second copy of it to drift: what the gate
 * measures is what `pnpm bench` runs, cell for cell, and a cell added for one driver
 * cannot be missing from the other.
 *
 * Three properties of a cell are the gate's, not vitest's, and they are why the shape
 * below is not simply `bench(name, fn)`:
 *
 * - **`expect`** is verified once, outside every timed region, before the cell is
 *   measured. A "success" cell that actually fails, and a failure cell that fails
 *   earlier in the chain than the step under test, are the two mistakes the previous
 *   generation of bench files made most often — `toString`, `toLowercase`,
 *   `toTrimmed*`, and `transform` all failed inside `string`/`number` and never
 *   reached their own step. Declaring the issue codes a failure cell must produce
 *   turns that from a review question into a runtime one.
 * - **`batch`** exists because `measure.mjs` reads `process.hrtime.bigint()` every 16
 *   iterations and that read costs about 15 ns. On a 2.6 ns cell the harness is 88% of
 *   the measurement, so a real 25% regression arrives as 5% — at the threshold.
 *   Batching does not make a cell more stable (the noise is between processes) but it
 *   removes that dilution, and it is free for the same reason. Size `batch` so one
 *   unit is roughly 1–10 µs of real work.
 * - **`group`** is deliberately coarse and shared across steps. The severe-group
 *   trigger needs at least two *measured* cells in a group before it can fire — and
 *   the group is estimated over every one of them, not over the cells whose own
 *   measurement happened to be decisive — so per-step groups of two or three cells
 *   would routinely lose the one trigger that catches a broad moderate regression.
 */

import { bench, describe } from 'vitest'

/**
 * The aggregate a cell belongs to. Coarse and semantic on purpose: these are the
 * groups `benchmarks/src/impact-verdict.mjs` computes a geometric mean over, and the
 * names match the cross-library suite's so the same prose describes both.
 *
 * `baseline` is the one group the impact gate excludes. A cell in it measures
 * JavaScript rather than the library — `typeof value === 'string'` beside the step
 * that wraps it — which is useful when reading a local `pnpm bench` table and
 * meaningless as a before/after comparison of two builds of this library, since
 * neither build contains it.
 */
export type StepBenchGroup
	= | 'construction'
		| 'cold'
		| 'warm/success'
		| 'warm/failure/library-default'
		| 'warm/failure/all'
		| 'warm/async/success'
		| 'warm/async/failure/library-default'
		| 'baseline'

/**
 * What one execution of the cell must produce, checked before it is measured.
 *
 * A failure expectation names issue codes rather than only a count, because the
 * question a failure cell exists to answer is *whose* failure it measures. At least
 * one declared code must be the step's own — `<step-name>:<snake_case>`, which
 * `scripts/check-issue-codes.ts` already guarantees is the spelling — and
 * `scripts/check-bench-cells.ts` decides that against the codes the result really
 * carries.
 */
export type StepBenchExpectation
	= | { success: true }
		| { success: false, issues: readonly [string, ...string[]] }
	/** A construction cell returns a schema rather than a result. */
		| { constructs: true }

export interface StepBenchCell {
	/** Cell name within the step. The full cell id is `<step>/<name>`. */
	name: string
	group: StepBenchGroup
	/** Verified once, outside every timed region, before the cell is measured. */
	expect: StepBenchExpectation
	/**
	 * Iterations in one measured unit. Size it so the unit is roughly 1–10 µs of real
	 * work: at one iteration a cheap step measures the harness's clock reads more than
	 * itself, and far above 10 µs a unit stops being a per-operation number.
	 */
	batch: number
	/**
	 * The measured work: **one** operation, returning its result so the expectation can
	 * be checked and so V8 cannot eliminate it. Construct the schema above the cell —
	 * `benchmarks/src/cells/` refuses a `run` that builds one, except in the
	 * `construction` and `cold` groups where building it is the subject.
	 */
	run: () => unknown
	/**
	 * Whether the operation returns a promise that must be awaited inside the timed
	 * region. Declared rather than detected: a Valchecker pipeline is maybe-async, so it
	 * returns a promise for some inputs and a plain result for others, and a probe would
	 * classify a cell by its fixture. The drivers check the declaration against reality.
	 */
	async?: boolean
}

/** One cell as both drivers see it, with the derived fields they need. */
export interface ResolvedStepBenchCell extends StepBenchCell {
	/** `<step>/<name>`, unique across the repository. */
	id: string
	step: string
	async: boolean
	/** `batch` iterations of `run`, which is the unit both drivers time. */
	measuredUnit: () => unknown
}

export interface RegisteredStepBench {
	step: string
	cells: ResolvedStepBenchCell[]
}

const groups = new Set<string>([
	'construction',
	'cold',
	'warm/success',
	'warm/failure/library-default',
	'warm/failure/all',
	'warm/async/success',
	'warm/async/failure/library-default',
	'baseline',
])

const registry: RegisteredStepBench[] = []

/**
 * Every `stepBench()` call this process has seen, in call order. The gate driver reads
 * this after importing a bench file; nothing else does.
 */
export function registeredStepBenches(): readonly RegisteredStepBench[] {
	return registry
}

// Assigned rather than discarded, so V8 cannot eliminate the batched operation. The
// same reason `benchmarks/src/measure.mjs` keeps a module-level sink.

let sink: unknown

function batchOf(cell: StepBenchCell): () => unknown {
	const { run, batch } = cell
	if (cell.async === true) {
		return async () => {
			for (let index = 0; index < batch; index++)
				sink = await run()
			return sink
		}
	}
	return () => {
		for (let index = 0; index < batch; index++)
			sink = run()
		return sink
	}
}

function resolveCell(step: string, cell: StepBenchCell, names: Set<string>): ResolvedStepBenchCell {
	if (typeof cell.name !== 'string' || cell.name.length === 0)
		throw new TypeError(`A ${step} bench cell has no name.`)
	if (names.has(cell.name))
		throw new TypeError(`${step} declares two bench cells named '${cell.name}'; a cell id must be unique.`)
	names.add(cell.name)
	if (!groups.has(cell.group))
		throw new TypeError(`${step}/${cell.name} declares the unknown bench group '${String(cell.group)}'. Use one of ${[...groups].join(', ')}.`)
	if (!Number.isInteger(cell.batch) || cell.batch < 1)
		throw new TypeError(`${step}/${cell.name} declares batch ${String(cell.batch)}; it must be a positive integer sized so one measured unit is roughly 1–10 µs.`)
	if (typeof cell.run !== 'function')
		throw new TypeError(`${step}/${cell.name} has no \`run\` function.`)
	const expectation = cell.expect
	if (expectation == null || typeof expectation !== 'object')
		throw new TypeError(`${step}/${cell.name} must declare what executing it produces via \`expect\`.`)
	if ('success' in expectation && expectation.success === false) {
		if (!Array.isArray(expectation.issues) || expectation.issues.length === 0)
			throw new TypeError(`${step}/${cell.name} expects a failure, so it must name the issue codes that failure produces.`)
	}
	else if (!('success' in expectation) && !('constructs' in expectation)) {
		throw new TypeError(`${step}/${cell.name} declares an \`expect\` this driver does not recognise.`)
	}
	return {
		...cell,
		id: `${step}/${cell.name}`,
		step,
		async: cell.async === true,
		measuredUnit: batchOf(cell),
	}
}

/**
 * Declares a step's benchmark cells. Registers them with vitest for `pnpm bench` and
 * with the registry the impact gate reads.
 *
 * `step` is the step's public name and must match the directory the file sits in;
 * `benchmarks/src/cells/` checks that, so the argument cannot quietly disagree with
 * the step whose cells the selector will attribute to it.
 */
export function stepBench(step: string, cells: readonly StepBenchCell[]): void {
	if (typeof step !== 'string' || step.length === 0)
		throw new TypeError('stepBench() requires the step\'s public name.')
	if (!Array.isArray(cells) || cells.length === 0)
		throw new TypeError(`${step} declares no bench cells.`)
	const names = new Set<string>()
	const resolved = cells.map(cell => resolveCell(step, cell, names))
	registry.push({ step, cells: resolved })
	describe(`${step} benchmarks`, () => {
		for (const cell of resolved)
			bench(cell.name, cell.measuredUnit as () => void)
	})
}
