<!-- step-doc
category: primitives
section: numeric
summary: `NaN`, through `Number.isNaN`
-->

### `isNaN(options?)`

Checks that the number is `NaN`, delegating to `Number.isNaN`. Every other number fails, including
`Infinity` and `-Infinity`.

```ts
v.number()
	.isNaN()
	.execute(Number.NaN)
// { value: NaN }

v.number()
	.isNaN()
	.execute(0)
// failure
```

**Issue code:** `isNaN:expected_nan` — the number is not `NaN`. Payload `{ value }`.
