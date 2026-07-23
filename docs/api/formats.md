# String formats

String-format validators check that a `string` output matches a well-known
format. Every validator is a dedicated, tree-shakable step: it is
value-preserving (a success returns the input unchanged), owns one issue code of
the form `<name>:expected_<format>`, and takes an optional trailing options
object carrying at least `message`.

They are available after any step whose output is a `string`, for example
`v.string()`:

```ts
import { createValchecker, isEmail, string } from 'valchecker'

const v = createValchecker({ steps: [string, isEmail] })
const schema = v.string()
	.isEmail()
schema.execute('ada@example.com') // { value: 'ada@example.com' }
```

The default `v` instance from `valchecker` bundles every validator, so
`v.string().isUrl()` works without registration.

Each validator documents its strictness and the specification it targets. None
of them add hidden policy beyond the named format — for example `isEmail()` does
not separately enforce a non-empty string, and `isBase64()` accepts the empty
string because it is the encoding of empty input.

## Parsed formats

These validators do more than match a pattern.

### `isUrl(options?)`

Parses the string with the WHATWG `URL` constructor and checks the scheme
against an allow-list. The default allow-list is `['http', 'https']`. Override
it with `protocols` (scheme names without the trailing colon). The allowed
protocols are included in the failure payload.

```ts
v.string()
	.isUrl() // http/https only
v.string()
	.isUrl({ protocols: ['ftp', 'sftp'] })
```

**Issue code:** `isUrl:expected_url`

### `isIp(options?)`

Checks an IPv4 or IPv6 address. IPv4 octets are range-checked (0–255, no leading
zeros); IPv6 supports `::` zero-compression and an embedded IPv4 suffix. Zone
identifiers are not accepted. Restrict to one family with `version` (`4` or
`6`); by default both are accepted.

**Issue code:** `isIp:expected_ip`

### `isIsoDate(options?)`, `isIsoTime(options?)`, `isIsoDateTime(options?)`

Validate ISO 8601 shapes and reject impossible calendar values (for example
`2026-02-30`) via a `Date` round-trip rather than a pattern alone.

- `isIsoDate` — `YYYY-MM-DD`.
- `isIsoTime` — `HH:MM:SS` with optional fractional seconds and no time-zone.
- `isIsoDateTime` — a date and time joined by `T`, with optional fractional
  seconds and an optional `Z` or `±HH:MM` offset.

**Issue codes:** `isIsoDate:expected_iso_date`, `isIsoTime:expected_iso_time`,
`isIsoDateTime:expected_iso_date_time`

### `isJwt(options?)`

Checks a JSON Web Token: three base64url segments separated by dots. The header
is base64url-decoded, parsed as JSON, and required to be an object carrying a
string `alg`. The signature segment may be empty (an unsecured JWS).

**Issue code:** `isJwt:expected_jwt`

### `isEmoji(options?)`

Checks that the string consists solely of RGI emoji, using `\p{RGI_Emoji}` with
the `v` flag. ZWJ sequences (such as family emoji) and skin-tone modifier
sequences each count as one emoji. The empty string is rejected.

**Issue code:** `isEmoji:expected_emoji`

### `isEmail(options?)`

Checks an email address with the pragmatic WHATWG HTML `<input type="email">`
pattern. It is intentionally not a full RFC 5322 parser; it does not require a
dot in the domain and rejects whitespace and a missing local or domain part.

**Issue code:** `isEmail:expected_email`

## Pattern formats

These validators are backed by a single canonical, vetted regular expression.
The dedicated step still earns its keep through a semantic issue code, a clean
default message, and discoverability.

### `isUuid(options?)`

RFC 9562 / RFC 4122 UUID. Accepts versions 1–8 with a canonical variant nibble,
plus the special nil and max UUIDs. Case-insensitive.

**Issue code:** `isUuid:expected_uuid`

### `isHex(options?)`

One or more hexadecimal digits, case-insensitive. No `0x` prefix and no
even-length policy.

**Issue code:** `isHex:expected_hex`

### `isMac(options?)`

EUI-48 MAC address as six colon- or hyphen-separated hexadecimal octets.
Case-insensitive.

**Issue code:** `isMac:expected_mac`

### `isHostname(options?)`

RFC 1123 hostname: dot-separated labels of 1–63 characters, each starting and
ending with an alphanumeric character, with a total length of at most 253.

**Issue code:** `isHostname:expected_hostname`

### `isBase64(options?)` and `isBase64Url(options?)`

- `isBase64` — standard RFC 4648 base64 with canonical padding.
- `isBase64Url` — unpadded RFC 4648 §5 base64url (URL- and filename-safe
  alphabet, no `=` padding).

Both accept the empty string.

**Issue codes:** `isBase64:expected_base64`, `isBase64Url:expected_base64_url`

### `isCuid2(options?)`

A CUID2 as produced by `@paralleldrive/cuid2`: a lowercase base-36 string
starting with a letter, 2–32 characters long.

**Issue code:** `isCuid2:expected_cuid2`

### `isUlid(options?)`

A ULID: 26 characters of Crockford base32 (digits and uppercase letters
excluding I, L, O, U). Case-insensitive.

**Issue code:** `isUlid:expected_ulid`

### `isNanoid(options?)`

Uses only the default Nano ID alphabet (`A-Za-z0-9_-`). Length is not
constrained because Nano ID size is configurable at generation time.

**Issue code:** `isNanoid:expected_nanoid`

## Custom messages

Like every issue-producing step, each validator accepts a static message or a
typed message handler in its options object:

```ts
v.string()
	.isEmail({ message: 'Enter a valid email.' })
v.string()
	.isUrl({
		protocols: ['https'],
		message: ({ payload }) => `${payload.value} must use one of ${payload.protocols.join(', ')}`,
	})
```
