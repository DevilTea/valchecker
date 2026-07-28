# String formats

String-format validators check that a `string` output matches a well-known
format. Every validator is a dedicated, tree-shakable step: it is
value-preserving (a success returns the input unchanged), owns a validation issue
code of the form `<name>:expected_<format>`, and takes an optional trailing
options object carrying at least `message`. One of them, `isEmoji()`, owns a
second issue for a runtime that cannot express the set it was asked for.

They are available after any step whose output is a `string`, for example
`v.string()`:

<!-- typecheck-isolate -->
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
it with `protocols` (scheme names without the trailing colon; matched
case-insensitively). The allowed protocols are included in the failure payload.

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

Validate the documented ISO 8601 shapes and reject impossible values. Month lengths and the leap-year rule are part of the accepted shape for `isIsoDate` and for the date portion of `isIsoDateTime`, as are the time and offset field ranges for `isIsoTime` and for the time portion of `isIsoDateTime`, so `2026-02-30`, `2023-02-29`, and `24:00:00` are all rejected. Each grammar has a single definition shared by the steps that use it, so their accepted shapes cannot drift apart.

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

Checks that the string is one or more emoji and nothing else. The empty string is
rejected.

The default accepted set is the [UTS #51](https://www.unicode.org/reports/tr51/)
emoji sequence grammar, built from Unicode property escapes so it tracks the
engine's Unicode version rather than a release date. It accepts an
emoji-presentation character, an emoji character followed by VS16, a keycap
sequence, a skin-tone modifier sequence, a regional indicator pair, a tag
sequence, and a ZWJ chain of those — one after another, in any number.

A bare `Emoji_Component` is not an emoji by itself, so a lone skin-tone modifier
(`🏽`), a lone hair component (`🦰`), a lone regional indicator (`🇦`), a lone
ZWJ, a lone VS16, a lone tag character, and a lone combining keycap are all
rejected. So are `1`, `123`, `#`, `*`, and a text-presentation character without
its VS16, such as `❤`, `☺`, or `©`.

Adding VS16 does not promote a component to a whole emoji either. Forty-seven
`Emoji_Component` characters are also `\p{Emoji}`, so all forty-seven match the
UTS #51 production for an emoji presentation sequence — but ED-9a admits only the
sequences listed in `emoji-variation-sequences.txt`, and the keycap bases `#`,
`*`, and `0`–`9` are the only components in that file. So `1️` (U+0031 U+FE0F) is
accepted while `🏽️` (U+1F3FD U+FE0F), `🇦️` (U+1F1E6 U+FE0F), and `🦰️`
(U+1F9B0 U+FE0F) are rejected, as are the composites those would otherwise
unlock, such as `🏽️` opening a ZWJ chain or standing as a tag base.

`isEmoji({ registered: true })` narrows the accepted set to Unicode's RGI set —
`\p{RGI_Emoji}` minus bare components — which is the sequences every vendor is
expected to render. What that costs depends on the input, because a
property-of-strings match explores every longer registered sequence its input is
a prefix of, and a fully specified sequence matches one alternative and stops:

| Input | Default | `{ registered: true }` | Ratio |
| --- | ---: | ---: | ---: |
| `😀` | 47 ns | 5,293 ns | 113× |
| `👍` | 51 ns | 5,282 ns | 104× |
| `👍🏽` | 29 ns | 2,966 ns | 102× |
| `🇹🇼` | 18 ns | 781 ns | 43× |
| `👨‍👩‍👧‍👦` | 193 ns | 243 ns | 1.3× |
| `👍a` (invalid) | 87 ns | 5,791 ns | 67× |

Measured 2026-07-28 on Node.js 24.15.0, interleaved, median of nine runs of
200,000 after a 100,000 warmup, through the built package.

It also needs a runtime with the regular-expression `v` flag; where that flag is
missing it fails with `isEmoji:unsupported_registered_set` rather than silently
accepting a different set.

The default therefore accepts structurally valid sequences that are not
registered. Written with code points, because the joiners are invisible:

| Input | Default | `{ registered: true }` | Why |
| --- | :-: | :-: | --- |
| `👍‍👍` (U+1F44D ZWJ U+1F44D) | accepted | rejected | a well-formed ZWJ chain that is not a registered emoji |
| `😀‍🚀` (U+1F600 ZWJ U+1F680) | accepted | rejected | the same |
| `1️` (U+0031 U+FE0F) | accepted | rejected | an emoji presentation sequence, but not the keycap sequence `1️⃣` |
| `🇦🇦` (U+1F1E6 U+1F1E6) | accepted | rejected | a regional indicator pair that is not a country |
| `⌚️` (U+231A U+FE0F) | accepted | rejected | a redundant VS16 on a character that already presents as emoji |
| `🏴󠁵󠁳󠁣󠁡󠁿` (U+1F3F4 + `usca` + U+E007F) | accepted | rejected | a well-formed tag sequence; only `gbeng`, `gbsct`, and `gbwls` are registered |
| `👪🏻` (U+1F46A U+1F3FB) | accepted | rejected | a modifier base and a skin tone whose combination is not registered |

**Issue codes:** `isEmoji:expected_emoji` (payload `{ value, registered }`),
`isEmoji:unsupported_registered_set` (category `operation`, payload
`{ value, error }`, reachable only with `registered: true`)

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

EUI-48 MAC address as six hexadecimal octets, each followed by either `:` or `-` except the last. Matching is case-insensitive; the current pattern does not require the same separator at every position.

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
starting with a letter, 2–32 characters long. This is a pragmatic pattern
capped at 32 characters, so cuid2 IDs configured with a length greater than 32
are not accepted.

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