<!-- step-doc
category: formats
section: pattern
summary: CUID2 as `@paralleldrive/cuid2` produces it, capped at 32 characters
-->

### `isCuid2(options?)`

A CUID2 as produced by `@paralleldrive/cuid2`: a lowercase base-36 string starting with a letter,
2–32 characters long. This is a pragmatic pattern capped at 32 characters, so cuid2 IDs configured
with a length greater than 32 are not accepted.

```ts
v.string()
	.isCuid2()
	.execute('tz4a98xxat96iws9zmbrgj3a')
// { value: 'tz4a98xxat96iws9zmbrgj3a' }

v.string()
	.isCuid2()
	.execute('1abc')
// failure
```

**Issue code:** `isCuid2:expected_cuid2` — the string is not a valid CUID2. Payload `{ value }`.
