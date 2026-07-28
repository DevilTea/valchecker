<!-- step-doc
category: formats
section: parsed
summary: pragmatic WHATWG `<input type="email">` pattern
-->

### `isEmail(options?)`

Checks an email address with the pragmatic WHATWG HTML `<input type="email">` pattern. It is
intentionally not a full RFC 5322 parser; it does not require a dot in the domain and rejects
whitespace and a missing local or domain part. Beyond that pattern it adds no policy — in
particular it does not separately enforce a non-empty string.

```ts
v.string()
	.isEmail()
	.execute('ada@example.com')
// { value: 'ada@example.com' }

v.string()
	.isEmail({ message: 'Enter a valid email.' })
```

**Issue code:** `isEmail:expected_email` — the string does not match the pattern. Payload
`{ value }`.
