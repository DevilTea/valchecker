<!-- step-doc
category: formats
section: pattern
summary: standard RFC 4648 base64 with canonical padding
-->

### `isBase64(options?)`

Standard RFC 4648 base64 with canonical padding. It adds no policy beyond that format — in
particular it accepts the empty string, because that is the encoding of empty input.

```ts
v.string()
	.isBase64()
	.execute('aGVsbG8=')
// { value: 'aGVsbG8=' }

v.string()
	.isBase64()
	.execute('')
// { value: '' }
```

**Issue code:** `isBase64:expected_base64` — the string is not a valid base64 string. Payload
`{ value }`.
