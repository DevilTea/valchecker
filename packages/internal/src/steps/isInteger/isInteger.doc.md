<!-- step-doc
category: primitives
section: numeric
summary: integers, through `Number.isInteger`
-->

### `isInteger(options?)`

Checks that the number is an integer, delegating to `Number.isInteger`. A fractional value, `NaN`,
and the infinities fail; the check places no bound on magnitude, so an integer beyond the safe
range still passes. Use `isSafeInteger()` for that narrower contract.

```ts
v.number()
	.isInteger()
	.execute(42)
// { value: 42 }

v.number()
	.isInteger()
	.execute(1.5)
// failure
```

**Issue code:** `isInteger:expected_integer` — the value is not an integer. Payload `{ value }`.
