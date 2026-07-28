<!-- step-doc
category: primitives
section: initial
summary: every JavaScript number, including `NaN` and the infinities
-->

### `number(options?)`

Checks that the value is a JavaScript number. This matches the TypeScript `number` type, so it
accepts `NaN`, `Infinity`, and `-Infinity`: the step has no hidden finite-number policy. Compose
`isFinite()` when the application requires a finite number.

```ts
v.number()
	.execute(Number.NaN) // success
v.number()
	.execute(Number.POSITIVE_INFINITY) // success
v.number()
	.isFinite()
	.execute(Number.POSITIVE_INFINITY) // failure
```

**Issue code:** `number:expected_number` — the value is not a number. Payload `{ value }`.
