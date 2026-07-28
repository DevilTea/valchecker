<!-- step-doc
category: primitives
section: numeric
summary: strict upper bound on a number or bigint
-->

### `isLessThan(maximum, options?)`

Checks that a number or bigint is strictly less than the configured bound, with the native `<`
comparison, so the bound itself is rejected. The operand follows the current output: a `number`
schema takes a `number` bound, a `bigint` schema takes a `bigint` one. `Number.NaN` never satisfies
the comparison, and the step adds no policy of its own for it.

```ts
v.number()
	.isLessThan(2)
	.execute(2)
// failure

v.bigint()
	.isLessThan(2n)
	.execute(1n)
// { value: 1n }
```

**Issue code:** `isLessThan:expected_less_than` — the value is not less than the bound. Payload
`{ target, value, maximum }`, where `target` is `'number'` or `'bigint'`.
