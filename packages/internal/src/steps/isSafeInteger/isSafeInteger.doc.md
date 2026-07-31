<!-- step-doc
category: primitives
section: numeric
summary: safe integers, through `Number.isSafeInteger`
-->

### `isSafeInteger(options?)`

Checks that the number is a safe integer, delegating to `Number.isSafeInteger`. It accepts
`Number.MAX_SAFE_INTEGER` and rejects anything above it, along with fractional values, `NaN`, and
the infinities.

```ts
v.number()
	.isSafeInteger()
	.execute(Number.MAX_SAFE_INTEGER)
// { value: 9007199254740991 }

v.number()
	.isSafeInteger()
	.execute(Number.MAX_SAFE_INTEGER + 1)
// failure
```

**Issue code:** `isSafeInteger:expected_safe_integer` — the value is not a safe integer. Payload
`{ value }`.
