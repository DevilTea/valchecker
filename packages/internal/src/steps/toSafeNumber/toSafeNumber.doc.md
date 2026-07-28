<!-- step-doc
category: transforms
section: primitive-conversion
summary: bigint to number, only within the safe integer range
-->

### `toSafeNumber(options?)`

Converts a bigint to a number, but only when the bigint is within JavaScript's safe integer range,
so the result never loses precision. The method is available after a `bigint` output. Use
`toNumber()` when the native `Number(bigint)` precision loss is acceptable.

```ts
v.bigint()
	.toSafeNumber()
	.execute(42n)
// { value: 42 }

v.bigint()
	.toSafeNumber()
	.execute(BigInt(Number.MAX_SAFE_INTEGER) + 1n)
// failure
```

**Issue code:** `toSafeNumber:out_of_safe_integer_range` — the bigint is outside
`Number.MIN_SAFE_INTEGER` through `Number.MAX_SAFE_INTEGER`, both of which are accepted. Payload
`{ value, minimum, maximum }`, with the two bounds as bigints.
