<!-- step-doc
category: formats
section: parsed
summary: three base64url segments with a decodable JOSE header
-->

### `isJwt(options?)`

Checks a JSON Web Token: three base64url segments separated by dots. The header is
base64url-decoded, parsed as JSON, and required to be an object carrying a string `alg`. The header
and payload segments must be non-empty; the signature segment may be empty (an unsecured JWS). The
segments are checked against the same base64url definition `isBase64Url()` uses, so one library does
not answer "is this base64url?" two ways.

```ts
v.string()
	.isJwt()
	.execute('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig')
// { value: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig' }

v.string()
	.isJwt()
	.execute('eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.') // unsecured JWS, empty signature
// success
```

**Issue code:** `isJwt:expected_jwt` — the string is not a valid JWT. Payload `{ value }`.
