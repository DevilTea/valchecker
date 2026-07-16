# Benchmarking Guide

Every built-in step implementation requires a benchmark file. Benchmark semantic behavior, not only the fastest success path.

## File template

```ts
import { bench, describe } from 'vitest'
import { createValchecker, isAtLeast, number } from '../..'

const v = createValchecker({ steps: [number, isAtLeast] })
const schema = v.number().isAtLeast(0)

describe('isAtLeast benchmarks', () => {
	bench('success above boundary', () => {
		schema.execute(42)
	})

	bench('success at boundary', () => {
		schema.execute(0)
	})

	bench('failure below boundary', () => {
		schema.execute(-1)
	})
})
```

Construct schemas outside benchmark callbacks unless schema construction itself is the scenario being measured.

## Loose primitive benchmark

```ts
import { bench, describe } from 'vitest'
import { createValchecker, looseNumber } from '../..'

const schema = createValchecker({ steps: [looseNumber] })
	.looseNumber()

describe('looseNumber benchmarks', () => {
	bench('number pass-through', () => {
		schema.execute(42)
	})

	bench('decimal string normalization', () => {
		schema.execute('42')
	})

	bench('prefixed string normalization', () => {
		schema.execute('0x10')
	})

	bench('invalid string', () => {
		schema.execute('invalid')
	})
})
```

Include representative paths rather than only the cheapest grammar branch.

## Transformation benchmark

```ts
const schema = v.string().toSplit(',')

bench('split three fields', () => {
	schema.execute('a,b,c')
})
```

For JSON transformations, benchmark valid input and issue-producing invalid input separately.

## Running benchmarks

```bash
pnpm bench
pnpm bench -- --reporter=verbose
pnpm bench packages/internal/src/steps/isFinite
```

Repository-level workflows also generate cross-library and tree-shaking reports. Use those reports for release and PR decisions rather than extrapolating from one microbenchmark.

## Comparison rules

- Compare equivalent validation and transformation semantics.
- Pin competitor versions.
- Keep fixture size and success or failure outcome equivalent.
- Separate schema construction, cold execution, and warmed execution.
- Treat relative margin of error above 5% as unstable.
- Compare multiple runs before keeping a small optimization.
- Record runtime and bundle-size trade-offs separately.

## Tree-shaking scenarios

Selective Valchecker scenarios must use the public plugin exports and the current method names:

```ts
import {
	createValchecker,
	isFinite,
	number,
} from 'valchecker'

const v = createValchecker({ steps: [number, isFinite] })
export const schema = v.number().isFinite()
```

The generated minimal bundle is scanned for unrelated plugin markers. A selective size reduction without marker elimination is not sufficient evidence.

## Reviewing results

A performance change is valuable only when:

1. the semantics remain unchanged,
2. relevant tests and coverage remain complete,
3. the measured improvement is larger than noise,
4. regressions in failure paths or bundle size are understood,
5. the implementation remains maintainable.

Do not retain opaque code solely for a tiny benchmark gain.

## Common mistakes

- Benchmarking a schema that no longer compiles against the public API.
- Measuring construction inside an execution benchmark.
- Comparing Valchecker finite-number validation with a competitor's unrestricted number type.
- Ignoring issue construction in failure benchmarks.
- Using only a single run or machine state.
- Reporting ops/sec without uncertainty or environment metadata.
- Rewriting the benchmark harness while evaluating a runtime optimization unless the harness change is independently validated.