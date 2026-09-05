<!-- step-doc
category: formats
section: parsed
summary: structurally strict JWTs using JWS Compact Serialization
-->

### `isJwt(options?)`

Checks a JWT carried in JWS Compact Serialization (`header.payload.signature`). Header and payload are
non-empty base64url segments that must decode as valid UTF-8 JSON objects: the JOSE header must contain
a non-empty string `alg`, and the payload is the JWT Claims Set. `alg: "none"` requires an empty
signature segment; every other algorithm name requires a non-empty base64url signature. The step does
not restrict algorithms to a known list and does not cryptographically verify a signature. `typ:
"JWT"` is not required. Five-segment JWE compact serialization is outside this step's contract.

The segments use the same unpadded base64url definition as `isBase64Url()`, so one library does not
answer "is this base64url?" two ways.

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
