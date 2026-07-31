<!-- step-doc
category: formats
section: pattern
summary: 26 characters of Crockford base32
-->

### `isUlid(options?)`

A ULID: 26 characters of Crockford base32 (digits and uppercase letters excluding I, L, O, U).
Case-insensitive.

```ts
v.string()
	.isUlid()
	.execute('01ARZ3NDEKTSV4RRFFQ69G5FAV')
// { value: '01ARZ3NDEKTSV4RRFFQ69G5FAV' }
```

**Issue code:** `isUlid:expected_ulid` — the string is not a valid ULID. Payload `{ value }`.
