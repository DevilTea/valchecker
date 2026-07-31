<!-- step-doc
category: primitives
section: initial
summary: the value `null`
-->

### `null(options?)`

Checks that the value is exactly `null`. `undefined` fails — `undefined()` covers that value, and
`isNonNullish()` narrows away both. The plugin is exported as `null_` for selective registration,
because `null` is a reserved word; the method it registers is still `v.null()`.

```ts
v.null()
	.execute(null)
// { value: null }

v.null()
	.execute(undefined) // failure
```

**Issue code:** `null:expected_null` — the value is not `null`. Payload `{ value }`.
