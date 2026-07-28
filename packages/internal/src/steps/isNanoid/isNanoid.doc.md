<!-- step-doc
category: formats
section: pattern
summary: the default Nano ID alphabet, with no length constraint
-->

### `isNanoid(options?)`

Uses only the default Nano ID alphabet (`A-Za-z0-9_-`). Length is not constrained because Nano ID
size is configurable at generation time.

```ts
v.string()
	.isNanoid()
	.execute('V1StGXR8_Z5jdHi6B-myT')
// { value: 'V1StGXR8_Z5jdHi6B-myT' }
```

**Issue code:** `isNanoid:expected_nanoid` — the string is not a valid Nano ID. Payload `{ value }`.
