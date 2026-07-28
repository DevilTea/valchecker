<!-- step-doc
category: formats
section: parsed
summary: WHATWG `URL` parse with a scheme allow-list
-->

### `isUrl(options?)`

Parses the string with the WHATWG `URL` constructor and checks the scheme against an allow-list. The
default allow-list is `['http', 'https']`. Override it with `protocols` (scheme names without the
trailing colon; matched case-insensitively). The allowed protocols are included in the failure
payload.

```ts
v.string()
	.isUrl() // http/https only
v.string()
	.isUrl({ protocols: ['ftp', 'sftp'] })
```

**Issue code:** `isUrl:expected_url` — the string does not parse as a URL, or its scheme is not in
the allow-list. Payload `{ value, protocols }`.
