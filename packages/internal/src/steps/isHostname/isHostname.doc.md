<!-- step-doc
category: formats
section: pattern
summary: RFC 1123 hostname, labels of 1–63 characters within 253
-->

### `isHostname(options?)`

RFC 1123 hostname: dot-separated labels of 1–63 characters, each starting and ending with an
alphanumeric character, with a total length of at most 253. Matching is case-insensitive.

```ts
v.string()
	.isHostname()
	.execute('sub.domain.example.org')
// { value: 'sub.domain.example.org' }

v.string()
	.isHostname()
	.execute('-bad.com')
// failure
```

**Issue code:** `isHostname:expected_hostname` — the string is not a valid hostname. Payload
`{ value }`.
