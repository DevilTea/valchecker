<!-- step-doc
category: transforms
section: primitive-conversion
summary: native `BigInt(value)` conversion
-->

### `toBigint(options?)`

Converts the current value with JavaScript's native `BigInt()` conversion. It adds no parsing
grammar and no safety policy: `'0x10'` becomes `16n` and `'1.5'` throws, exactly as `BigInt(value)`
does.

The method is available after any output that is not already `bigint`, so the identity conversion
`bigint().toBigint()` is not offered.

```ts
v.string()
	.toBigint()
	.execute('0x10')
// { value: 16n }

v.string()
	.toBigint()
	.execute('1.5')
// failure
```

**Issue code:** `toBigint:conversion_failed` (`operation`) — the native `BigInt()` conversion threw,
which is what a non-integer numeric string, a non-integer or non-finite number, `null`, `undefined`,
and a symbol all do. Payload `{ value, error }`.
