<!-- Generated file. Do not edit it: `pnpm docs:api` fails when it stops matching its sources,
and `pnpm docs:api:update` rewrites it.

Each step's entry comes from `packages/internal/src/steps/<name>/<name>.doc.md`. The prose
around them, and the order the sections appear in, come from `scripts/docs-api-templates/<page>.md`. -->

# String formats

String-format validators check that a `string` output matches a well-known format. Every validator
is a dedicated, tree-shakable step: it is value-preserving (a success returns the input unchanged),
owns a validation issue code of the form `<name>:expected_<format>`, and takes an optional trailing
options object carrying at least `message`. One of them, `isEmoji()`, owns a second issue for a
runtime that cannot express the set it was asked for.

They are available after any step whose output is a `string`, for example `v.string()`:

<!-- typecheck-isolate -->
```ts
import { createValchecker, isEmail, string } from 'valchecker'

const v = createValchecker({ steps: [string, isEmail] })
const schema = v.string()
	.isEmail()
schema.execute('ada@example.com') // { value: 'ada@example.com' }
```

The default `v` instance from `valchecker` bundles every validator, so `v.string().isUrl()` works
without registration.

Each validator documents its strictness and the specification it targets. None of them add hidden
policy beyond the named format.

## Parsed formats

These validators do more than match a pattern.

### `isEmail(options?)` {#isEmail}

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

### `isEmoji(options?)` {#isEmoji}

Checks that the string is one or more emoji and nothing else. The empty string is rejected.

```ts
v.string()
	.isEmoji()
	.execute('🎉🎊')
// { value: '🎉🎊' }

v.string()
	.isEmoji({ registered: true })
	.execute('😀')
// { value: '😀' }
```

The default accepted set is the [UTS #51](https://www.unicode.org/reports/tr51/) emoji sequence
grammar, built from Unicode property escapes so it tracks the engine's Unicode version rather than a
release date. It accepts an emoji-presentation character, an emoji character followed by VS16, a
keycap sequence, a skin-tone modifier sequence, a regional indicator pair, a tag sequence, and a ZWJ
chain of those — one after another, in any number.

A bare `Emoji_Component` is not an emoji by itself, so a lone skin-tone modifier (`🏽`), a lone hair
component (`🦰`), a lone regional indicator (`🇦`), a lone ZWJ, a lone VS16, a lone tag character, and
a lone combining keycap are all rejected. So are `1`, `123`, `#`, `*`, and a text-presentation
character without its VS16, such as `❤`, `☺`, or `©`.

Adding VS16 does not promote a component to a whole emoji either. Forty-seven `Emoji_Component`
characters are also `\p{Emoji}`, so all forty-seven match the UTS #51 production for an emoji
presentation sequence — but ED-9a admits only the sequences listed in
`emoji-variation-sequences.txt`, and the keycap bases `#`, `*`, and `0`–`9` are the only
components in that file. So `1️` (U+0031 U+FE0F) is accepted while `🏽️` (U+1F3FD U+FE0F), `🇦️`
(U+1F1E6 U+FE0F), and `🦰️` (U+1F9B0 U+FE0F) are rejected, as are the composites those would
otherwise unlock, such as `🏽️` opening a ZWJ chain or standing as a tag base.

`isEmoji({ registered: true })` narrows the accepted set to Unicode's RGI set — `\p{RGI_Emoji}`
minus bare components — which is the sequences every vendor is expected to render. What that costs
depends on the input, because a property-of-strings match explores every longer registered sequence
its input is a prefix of, and a fully specified sequence matches one alternative and stops:

| Input | Default | `{ registered: true }` | Ratio |
| --- | ---: | ---: | ---: |
| `😀` | 47 ns | 5,293 ns | 113× |
| `👍` | 51 ns | 5,282 ns | 104× |
| `👍🏽` | 29 ns | 2,966 ns | 102× |
| `🇹🇼` | 18 ns | 781 ns | 43× |
| `👨‍👩‍👧‍👦` | 193 ns | 243 ns | 1.3× |
| `👍a` (invalid) | 87 ns | 5,791 ns | 67× |

Measured 2026-07-28 on Node.js 24.15.0, interleaved, median of nine runs of 200,000 after a 100,000
warmup, through the built package.

It also needs a runtime with the regular-expression `v` flag; where that flag is missing it fails
with `isEmoji:unsupported_registered_set` rather than silently accepting a different set.

The default therefore accepts structurally valid sequences that are not registered. Written with
code points, because the joiners are invisible:

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
`isEmoji:unsupported_registered_set` (category `operation`, payload `{ value, error }`, reachable
only with `registered: true`)

### `isIp(options?)` {#isIp}

Checks an IPv4 or IPv6 address. IPv4 octets are range-checked (0–255, no leading zeros); IPv6
supports `::` zero-compression and an embedded IPv4 suffix. Zone identifiers are not accepted.
Restrict to one family with `version` (`4` or `6`); by default both are accepted.

```ts
v.string()
	.isIp()
	.execute('192.168.0.1')
// { value: '192.168.0.1' }

v.string()
	.isIp({ version: 6 })
	.execute('192.168.0.1')
// failure
```

**Issue code:** `isIp:expected_ip` — the string is not an IP address of the requested family.
Payload `{ value, version }`, where `version` is the configured restriction and `undefined` when
both families are accepted.

### `isIsoDate(options?)` {#isIsoDate}

Validates the ISO 8601 calendar-date shape `YYYY-MM-DD` and rejects impossible values. Month lengths
and the leap-year rule are part of the accepted shape, so `2026-02-30` and `2023-02-29` are both
rejected. The calendar grammar has a single definition, shared with `isIsoDateTime`, so the two
accepted shapes cannot drift apart.

```ts
v.string()
	.isIsoDate()
	.execute('2026-07-23')
// { value: '2026-07-23' }

v.string()
	.isIsoDate()
	.execute('2026-02-30')
// failure
```

**Issue code:** `isIsoDate:expected_iso_date` — the string is not a valid ISO 8601 date. Payload
`{ value }`.

### `isIsoDateTime(options?)` {#isIsoDateTime}

Validates an ISO 8601 date and time joined by `T`, with optional fractional seconds and an optional
`Z` or `±HH:MM` offset, and rejects impossible values. Month lengths and the leap-year rule are part
of the accepted shape for the date portion, as are the field ranges for the time portion and the
offset, so `2026-02-30`, `2023-02-29`, and `24:00:00` are all rejected. The date grammar comes from
`isIsoDate` and the time and offset grammars from `isIsoTime`, each a single shared definition, so
the accepted shapes cannot drift apart.

```ts
v.string()
	.isIsoDateTime()
	.execute('2026-07-23T12:30:00Z')
// { value: '2026-07-23T12:30:00Z' }

v.string()
	.isIsoDateTime()
	.execute('2026-07-23T12:30:00+08:00')
// { value: '2026-07-23T12:30:00+08:00' }
```

**Issue code:** `isIsoDateTime:expected_iso_date_time` — the string is not a valid ISO 8601
date-time. Payload `{ value }`.

### `isIsoTime(options?)` {#isIsoTime}

Validates the ISO 8601 time-of-day shape `HH:MM:SS`, with optional fractional seconds and no
time-zone, and rejects impossible values. The field ranges (00–23, 00–59, 00–59) are part of the
accepted shape, so `24:00:00` is rejected. The time grammar has a single definition, shared with the
time portion of `isIsoDateTime`, so the two accepted shapes cannot drift apart.

```ts
v.string()
	.isIsoTime()
	.execute('12:30:45.123')
// { value: '12:30:45.123' }

v.string()
	.isIsoTime()
	.execute('24:00:00')
// failure
```

**Issue code:** `isIsoTime:expected_iso_time` — the string is not a valid ISO 8601 time. Payload
`{ value }`.

### `isJwt(options?)` {#isJwt}

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

### `isUrl(options?)` {#isUrl}

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

## Pattern formats

These validators are backed by a single canonical, vetted regular expression. The dedicated step
still earns its keep through a semantic issue code, a clean default message, and discoverability.

### `isBase64(options?)` {#isBase64}

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

### `isBase64Url(options?)` {#isBase64Url}

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

### `isCuid2(options?)` {#isCuid2}

A CUID2 as produced by `@paralleldrive/cuid2`: a lowercase base-36 string starting with a letter,
2–32 characters long. This is a pragmatic pattern capped at 32 characters, so cuid2 IDs configured
with a length greater than 32 are not accepted.

```ts
v.string()
	.isCuid2()
	.execute('tz4a98xxat96iws9zmbrgj3a')
// { value: 'tz4a98xxat96iws9zmbrgj3a' }

v.string()
	.isCuid2()
	.execute('1abc')
// failure
```

**Issue code:** `isCuid2:expected_cuid2` — the string is not a valid CUID2. Payload `{ value }`.

### `isHex(options?)` {#isHex}

One or more hexadecimal digits, case-insensitive. No `0x` prefix and no even-length policy.

```ts
v.string()
	.isHex()
	.execute('deadBEEF')
// { value: 'deadBEEF' }

v.string()
	.isHex()
	.execute('0x1f')
// failure
```

**Issue code:** `isHex:expected_hex` — the string is not a hexadecimal string. Payload `{ value }`.

### `isHostname(options?)` {#isHostname}

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

### `isMac(options?)` {#isMac}

EUI-48 MAC address as six hexadecimal octets, each followed by either `:` or `-` except the last.
Matching is case-insensitive; the current pattern does not require the same separator at every
position.

```ts
v.string()
	.isMac()
	.execute('00:1A:2B:3C:4D:5E')
// { value: '00:1A:2B:3C:4D:5E' }

v.string()
	.isMac()
	.execute('001A2B3C4D5E')
// failure
```

**Issue code:** `isMac:expected_mac` — the string is not a valid MAC address. Payload `{ value }`.

### `isNanoid(options?)` {#isNanoid}

Uses only the default Nano ID alphabet (`A-Za-z0-9_-`). Length is not constrained because Nano ID
size is configurable at generation time.

```ts
v.string()
	.isNanoid()
	.execute('V1StGXR8_Z5jdHi6B-myT')
// { value: 'V1StGXR8_Z5jdHi6B-myT' }
```

**Issue code:** `isNanoid:expected_nanoid` — the string is not a valid Nano ID. Payload `{ value }`.

### `isUlid(options?)` {#isUlid}

A ULID: 26 characters of Crockford base32 (digits and uppercase letters excluding I, L, O, U).
Case-insensitive.

```ts
v.string()
	.isUlid()
	.execute('01ARZ3NDEKTSV4RRFFQ69G5FAV')
// { value: '01ARZ3NDEKTSV4RRFFQ69G5FAV' }
```

**Issue code:** `isUlid:expected_ulid` — the string is not a valid ULID. Payload `{ value }`.

### `isUuid(options?)` {#isUuid}

RFC 9562 / RFC 4122 UUID. Accepts versions 1–8 with a canonical variant nibble, plus the special nil
and max UUIDs. Case-insensitive.

```ts
v.string()
	.isUuid()
	.execute('123e4567-e89b-12d3-a456-426614174000')
// { value: '123e4567-e89b-12d3-a456-426614174000' }
```

**Issue code:** `isUuid:expected_uuid` — the string is not a valid UUID. Payload `{ value }`.

## Custom messages

Like every issue-producing step, each validator accepts a static message or a typed message handler
in its options object:

```ts
v.string()
	.isEmail({ message: 'Enter a valid email.' })
v.string()
	.isUrl({
		protocols: ['https'],
		message: ({ payload }) => `${payload.value} must use one of ${payload.protocols.join(', ')}`,
	})
```
