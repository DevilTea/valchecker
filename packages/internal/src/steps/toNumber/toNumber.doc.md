<!-- step-doc
category: transforms
section: primitive-conversion
summary: native `Number(value)` conversion
-->

### `toNumber(options?)`

Converts the current value with JavaScript's native `Number()` coercion. It adds no parsing,
finite-number, or precision-safety policy: an invalid numeric string produces `NaN` and a large
bigint may lose precision, exactly as `Number(value)` does. Use `isFinite()` or `toSafeNumber()`
when a narrower contract is required.

The method is available after any output that is not already entirely `number`, so the identity
conversion `number().toNumber()` is not offered.

```ts
v.string()
	.toNumber()
	.execute('42')
// { value: 42 }

v.string()
	.toNumber()
	.execute('nope')
// { value: NaN }
```

**Issue code:** `toNumber:conversion_failed` (`operation`) — the native `Number()` conversion threw,
which is what a symbol input does. Payload `{ value, error }`.
