<!-- step-doc
category: primitives
section: loose
summary: a `boolean` or `"true"`/`"false"`, normalized to `boolean`
-->

### `looseBoolean(options?)`

Accepts a boolean, or one of the two strings TypeScript accepts as `${boolean}`, and normalizes the
output to a boolean. Loose booleans accept only `"true"` and `"false"`: no other casing, no `'1'`,
`'yes'`, or `'on'`, and no number. Use `toMappedBoolean()` when the input uses its own vocabulary.

```ts
v.looseBoolean()
	.execute('false') // { value: false }
v.looseBoolean()
	.execute('TRUE') // failure
v.looseBoolean()
	.execute(1) // failure
```

**Issue code:** `looseBoolean:expected_boolean` — the value is neither a boolean nor `"true"` or
`"false"`. Payload `{ value }`.
