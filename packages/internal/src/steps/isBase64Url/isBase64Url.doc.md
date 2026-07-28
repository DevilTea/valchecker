<!-- step-doc
category: formats
section: pattern
summary: unpadded RFC 4648 §5 base64url
-->

### `isBase64Url(options?)`

Unpadded RFC 4648 §5 base64url: the URL- and filename-safe alphabet (`-` and `_` in place of `+` and
`/`), with no `=` padding. Because a base64url string encodes whole bytes, its length is never
`1 (mod 4)` — a final group of one character cannot represent any byte. It accepts the empty string,
which validly encodes zero bytes; a caller that also requires content composes `isNotEmpty()`.

```ts
v.string()
	.isBase64Url()
	.execute('aGVsbG8')
// { value: 'aGVsbG8' }

v.string()
	.isBase64Url()
	.execute('aGVsbG8=')
// failure
```

**Issue code:** `isBase64Url:expected_base64_url` — the string is not a valid base64url string.
Payload `{ value }`.
