<!-- step-doc
category: primitives
section: initial
summary: `typeof value === 'boolean'`
-->

### `boolean(options?)`

Checks that the value is a boolean, following `typeof value === 'boolean'`. Nothing else is treated
as truthy or falsy: `0`, `1`, `'true'`, and `'false'` all fail. Use `looseBoolean()` for the
`"true"`/`"false"` strings, or `toMappedBoolean()` for an explicit mapping of other values.

```ts
v.boolean()
	.execute(true)
// { value: true }

v.boolean()
	.execute('true') // failure
```

**Issue code:** `boolean:expected_boolean` — the value is not a boolean. Payload `{ value }`.
