<!-- step-doc
category: structures
section: size-and-membership
summary: a value's `type` string against allowed MIME types, with `image/*` wildcards
-->

### `isMimeType(types, options?)`

Checks that a value's `type` string matches one of the allowed MIME types. Pass a single type or a
list. A trailing `/*` matches any subtype, and matching is case-insensitive following MIME
semantics. The successful value is preserved. Any output with a `type` string qualifies, including
`File` and `Blob`.

Matching compares the bare `type/subtype` only and does not parse MIME parameters: `text/plain` does
not match `text/plain;charset=utf-8`, though a `text/*` wildcard would. An empty type list throws a
`TypeError` during schema construction.

```ts
v.file()
	.isMimeType(['image/*', 'application/pdf'])
	.execute(new File(['data'], 'a.png', { type: 'image/png' })) // success
```

**Issue code:** `isMimeType:unexpected_mime_type` — the value's `type` matches no allowed MIME
type. Payload `{ value, expected, actual }`, where `expected` is the configured type or list and
`actual` is the observed `type`.
