<!-- step-doc
category: formats
section: pattern
summary: one or more hexadecimal digits, with no `0x` prefix
-->

### `isHex(options?)`

One or more hexadecimal digits, case-insensitive. No `0x` prefix and no even-length policy.

```ts
v.string()
	.isHex()
	.execute('deadBEEF')
// { value: 'deadBEEF' }

v.string()
	.isHex()
	.execute('0x1f')
// failure
```

**Issue code:** `isHex:expected_hex` — the string is not a hexadecimal string. Payload `{ value }`.
