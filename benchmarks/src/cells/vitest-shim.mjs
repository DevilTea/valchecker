/**
 * What `vitest` resolves to when a step's `<name>.bench.ts` is imported by this gate
 * instead of by `vitest bench`.
 *
 * A bench file's cells are declared as data and registered with the registry in
 * `packages/internal/src/test-utils/step-bench.ts`; the `describe`/`bench` calls that
 * module makes are for the local driver only. So the gate needs those two names to
 * exist and to do nothing, and it needs them without loading vitest itself — a test
 * runner in every one of the ~3400 measurement processes a paired sharded run spawns
 * would cost more than the measurement.
 *
 * `describe` deliberately does **not** invoke its callback. Nothing the gate reads
 * comes from inside it, and running it would execute the cell registration a second
 * time.
 */

export function describe() {}

export function bench() {}

/**
 * Present so a bench file that reaches for one fails with a clear message rather than
 * with `undefined is not a function`. A step bench file has no legitimate use for
 * them: `scripts/check-bench-cells.ts` allows it to import nothing but the package
 * entry and the `stepBench` helper.
 */
function unavailable(name) {
	return () => {
		throw new Error(
			`A step bench file called \`${name}()\`, which the impact gate's vitest shim does not implement. `
			+ 'Declare cells with `stepBench()` instead; only the local `pnpm bench` driver runs under vitest.',
		)
	}
}

export const it = unavailable('it')
export const test = unavailable('test')
export const expect = unavailable('expect')
export const beforeAll = unavailable('beforeAll')
export const beforeEach = unavailable('beforeEach')
export const afterAll = unavailable('afterAll')
export const afterEach = unavailable('afterEach')
