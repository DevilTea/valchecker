<!-- step-doc
category: primitives
section: numeric
summary: finite numbers, through `Number.isFinite`
-->

### `isFinite(options?)`

Checks that the number is finite, delegating to `Number.isFinite`. `NaN`, `Infinity`, and
`-Infinity` therefore fail. This is the step that adds a finite-number policy `number()` and the
bound validations deliberately leave out.

```ts
v.number()
	.isFinite()
	.execute(42)
// { value: 42 }

v.number()
	.isFinite()
	.execute(Number.NaN)
// failure
```

**Issue code:** `isFinite:expected_finite` — the number is `NaN`, `Infinity`, or `-Infinity`.
Payload `{ value }`.
