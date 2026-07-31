<!-- step-doc
category: primitives
section: initial
summary: `typeof value === 'bigint'`
-->

### `bigint(options?)`

Checks that the value is a bigint, following `typeof value === 'bigint'`. A number is not a bigint
and fails; `looseBigint()` accepts a `${bigint}` string, and `toBigint()` converts with native
`BigInt()`.

```ts
v.bigint()
	.execute(42n)
// { value: 42n }

v.bigint()
	.execute(42) // failure
```

**Issue code:** `bigint:expected_bigint` — the value is not a bigint. Payload `{ value }`.
