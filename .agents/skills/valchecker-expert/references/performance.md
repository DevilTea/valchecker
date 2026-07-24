# Performance

## Reuse schemas

Construct reusable schemas once rather than rebuilding them in hot loops:

```ts
const userSchema = v.object({
	name: v.string().toTrimmed().isNotEmpty(),
	email: v.string().toLowercase(),
})

for (const input of inputs)
	userSchema.execute(input)
```

Schemas are immutable and safe to share.

## Order cheap constraints before expensive work

```ts
const username = v.string()
	.toTrimmed()
	.isNotEmpty()
	.isLengthAtLeast(3)
	.isLengthAtMost(32)
	.check(value => USERNAME_RE.test(value))
	.check(async value => !(await usernameExists(value)))
```

Earlier synchronous failures can avoid later callbacks and asynchronous work.

## Use named constraints

```ts
const percentage = v.number()
	.isFinite()
	.isAtLeast(0)
	.isAtMost(100)
```

Named constraints are easier to audit and benchmark than repeatedly embedding compound predicates in `check()`.

## Avoid redundant transformations

```ts
const normalized = v.string()
	.toTrimmed()
	.toLowercase()
```

Do not repeat equivalent `transform()` calls after a concrete built-in transformation.

For arrays, filter before sorting when discarded elements do not need ordering:

```ts
const values = v.array(v.number().isFinite())
	.toFiltered(value => value > 0)
	.toSorted({ compareFn: (a, b) => a - b })
```

## Use loose primitives deliberately

Loose primitives normalize supported string representations without unrestricted coercion:

```ts
const page = v.looseNumber()
	.isFinite()
	.isInteger()
	.isAtLeast(1)
```

Do not pre-coerce with `Number()`, `Boolean()`, or `BigInt()` unless the broader coercion semantics are intentionally part of the application boundary.

## Optimize unions through branch order

`union()` returns the first successful branch's transformed output. Put common, cheap, and discriminating branches before expensive fallback branches when semantics permit it.

```ts
const role = v.union([
	v.literal('user'),
	v.literal('admin'),
	v.string().check(async value => await lookupLegacyRole(value)),
])
```

## Async work

Parallelize independent checks inside a callback or across independently validated object fields only when external systems can safely handle the concurrency.

Cache external lookup results only with an explicit expiry and invalidation policy. Validation does not replace transactional uniqueness constraints.

A maybe-async schema may still fail synchronously before asynchronous work is reached. `.toAsync()` adds a stable promise boundary but also forces promise allocation on every invocation, so use it at API boundaries rather than indiscriminately.

## Selective registration and bundle size

```ts
import {
	createValchecker,
	isAtLeast,
	isFinite,
	number,
} from 'valchecker'

const v = createValchecker({
	steps: [number, isFinite, isAtLeast],
})
```

The default `v` registers every built-in step. Selective instances make runtime inclusion explicit and are preferred for bundle-sensitive front-end code.

Use the repository tree-shaking report to verify that unselected plugin markers are absent from minimal bundles. Do not infer tree-shaking quality solely from source-module layout.

## Benchmarking

Measure schema construction separately from cold and warmed execution. Keep fixtures semantically equivalent across libraries and inspect relative margin of error.

```ts
import { bench } from 'vitest'

const schema = v.number().isFinite().isAtLeast(0)

bench('number validation', () => {
	schema.execute(42)
})
```

For changes to a built-in step:

1. run focused microbenchmarks,
2. run the cross-library benchmark suite,
3. run the tree-shaking report,
4. compare generated artifacts rather than only console summaries,
5. keep only changes with measured value and acceptable semantic trade-offs.

## Production monitoring

Record duration, outcome, issue code distribution, and schema identity without logging sensitive payload values.

```ts
const startedAt = performance.now()
const result = await schema.execute(input)
const durationMs = performance.now() - startedAt

metrics.observe('validation_duration_ms', durationMs, {
	schema: 'create-user',
	success: v.isSuccess(result),
})
```

## Guidance

- Construct once and reuse.
- Put cheap deterministic checks before expensive callbacks.
- Use named constraints and concrete transformations.
- Apply `.toAsync()` only when the promise contract is required.
- Prefer selective plugin registration for bundle-sensitive builds.
- Benchmark realistic inputs and inspect uncertainty.
- Never trade semantic correctness for an isolated microbenchmark improvement.