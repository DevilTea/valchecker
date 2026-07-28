<!-- step-doc
category: formats
section: pattern
summary: one or more characters of the default Nano ID alphabet
-->

### `isNanoid(options?)`

One or more characters of the default Nano ID alphabet (`A-Za-z0-9_-`). No maximum length is
imposed, because Nano ID size is configurable at generation time; the empty string is rejected.

```ts
v.string()
	.isNanoid()
	.execute('V1StGXR8_Z5jdHi6B-myT')
// { value: 'V1StGXR8_Z5jdHi6B-myT' }
```

**Issue code:** `isNanoid:expected_nanoid` — the string is not a valid Nano ID. Payload `{ value }`.
