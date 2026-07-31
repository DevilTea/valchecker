<!-- step-doc
category: primitives
section: numeric
summary: inclusive upper bound on a number or bigint
-->

### `isAtMost(maximum, options?)`

Checks that a number or bigint is less than or equal to `maximum`, with the native `<=` comparison,
so the bound itself is accepted. The operand follows the current output: a `number` schema takes a
`number` maximum, a `bigint` schema takes a `bigint` one.

```ts
v.number()
	.isAtMost(100)
	.execute(100)
// { value: 100 }

v.bigint()
	.isAtMost(10n)
	.execute(15n)
// failure
```

**Issue code:** `isAtMost:expected_at_most` — the value exceeds the maximum. Payload
`{ target, value, maximum }`, where `target` is `'number'` or `'bigint'`.
