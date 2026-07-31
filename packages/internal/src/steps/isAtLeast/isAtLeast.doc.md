<!-- step-doc
category: primitives
section: numeric
summary: inclusive lower bound on a number or bigint
-->

### `isAtLeast(minimum, options?)`

Checks that a number or bigint is greater than or equal to `minimum`, with the native `>=`
comparison, so the bound itself is accepted. The operand follows the current output: a `number`
schema takes a `number` minimum, a `bigint` schema takes a `bigint` one.

The step carries no finite-number policy, so `isAtLeast(0)` accepts positive infinity. Compose
`isFinite()` when both constraints are required.

```ts
v.number()
	.isAtLeast(0)
	.execute(Number.POSITIVE_INFINITY) // success
v.number()
	.isFinite()
	.isAtLeast(0)
	.execute(Number.POSITIVE_INFINITY) // failure

v.bigint()
	.isAtLeast(10n)
	.execute(10n)
// { value: 10n }
```

**Issue code:** `isAtLeast:expected_at_least` — the value is below the minimum. Payload
`{ target, value, minimum }`, where `target` is `'number'` or `'bigint'`.
