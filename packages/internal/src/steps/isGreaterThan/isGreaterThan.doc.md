<!-- step-doc
category: primitives
section: numeric
summary: strict lower bound on a number or bigint
-->

### `isGreaterThan(minimum, options?)`

Checks that a number or bigint is strictly greater than the configured bound, with the native `>`
comparison, so the bound itself is rejected. The operand follows the current output: a `number`
schema takes a `number` bound, a `bigint` schema takes a `bigint` one. `Number.NaN` never satisfies
the comparison, and the step adds no policy of its own for it.

`isGreaterThan(0)` accepts positive infinity; use `isFinite().isGreaterThan(0)` when both
constraints are required.

```ts
v.number()
	.isGreaterThan(1)
	.execute(1)
// failure

v.bigint()
	.isGreaterThan(1n)
	.execute(2n)
// { value: 2n }
```

**Issue code:** `isGreaterThan:expected_greater_than` — the value is not greater than the bound.
Payload `{ target, value, minimum }`, where `target` is `'number'` or `'bigint'`.
