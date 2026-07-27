// `string-format/*`, second wave: the built-in format validators that shipped
// after `isEmail`, `isUuid`, and `isIsoDateTime`, one validator per scenario.
// These are a separate module rather than extra entries in `string-format.mjs`
// so every pre-existing scenario keeps its position in the report.
//
// Six formats are missing from at least one pinned library, so those scenarios
// declare a required feature and the adapter is skipped with a stated reason.
// Substituting a hand-rolled regex would compare different work:
//
// - `combined IPv4/IPv6` — Zod 4 ships `z.ipv4()` and `z.ipv6()` separately and
//   has no combined address schema, while `isIp()` accepts either version;
// - `base64url`, `JWT` — Valibot has neither action;
// - `hex`, `MAC address` — Zod 3 has neither string method;
// - `hostname` — only Valchecker and Zod 4 have one.
import { warm } from './define.mjs'

// Every fixture below was executed against each participating adapter and all of
// them agreed on accept/reject; `pnpm --dir benchmarks verify` re-checks that on
// every run. Each invalid fixture is a near-miss of its valid twin, so a failure
// exercises the format check rather than the preceding string type check.
const inputs = {
	url: 'https://example.com/path',
	// A space in the host of the accepted URL.
	invalidUrl: 'https://exa mple.com/path',
	ip: '192.168.0.1',
	// One octet out of range. `2001:db8::1` would work too, but an IPv4 fixture
	// keeps the valid and invalid cases the same shape.
	invalidIp: '192.168.0.256',
	isoDate: '2024-03-05',
	// Month 13. `2024-02-30` was rejected as a fixture: Valibot's `isoDate` does
	// no calendar check and accepts it, so the libraries disagree there.
	invalidIsoDate: '2024-13-05',
	// `HH:MM:SS`, the granularity every participant accepts: Valchecker requires
	// the seconds that Valibot's `isoTime()` forbids, so the adapter uses
	// `isoTimeSecond()`, which in turn rejects the `.123` fraction Valchecker
	// allows.
	isoTime: '12:30:45',
	// Minute 60.
	invalidIsoTime: '12:60:45',
	emoji: '😀',
	// One leading non-emoji character.
	invalidEmoji: 'a😀',
	base64: 'aGVsbG8gd29ybGQ=',
	// The same payload with its padding removed.
	invalidBase64: 'aGVsbG8gd29ybGQ',
	nanoid: 'V1StGXR8_Z5jdHi6B-myT',
	// Final character outside the nanoid alphabet.
	invalidNanoid: 'V1StGXR8_Z5jdHi6B-my!',
	ulid: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
	// `U` is excluded from Crockford base32, so only the last character differs.
	invalidUlid: '01ARZ3NDEKTSV4RRFFQ69G5FAU',
	cuid2: 'tz4a98xxat96iws9zmbrgj3a',
	// A cuid2 must start with a lowercase letter.
	invalidCuid2: 'Tz4a98xxat96iws9zmbrgj3a',
	jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
	// One character dropped from the header, so it no longer decodes to JSON.
	// A three-segment token with a corrupted signature was rejected as a fixture
	// because Zod 4 accepts it.
	invalidJwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
	base64Url: 'aGVsbG8gd29ybGQ',
	// `+` belongs to base64, not to the URL-safe alphabet. Padding was rejected
	// as a fixture: Zod 3's `base64url()` accepts `aGVsbG8=` and the others do
	// not.
	invalidBase64Url: 'aGVsbG8+d29ybGQ',
	hex: 'deadBEEF',
	// `g` is not a hexadecimal digit. `0xdeadbeef` was rejected as a fixture
	// because Valibot's `hexadecimal()` accepts the `0x` prefix.
	invalidHex: 'deadbeeg',
	// Colon-separated: Zod 4's `mac()` rejects the hyphen-separated spelling that
	// Valchecker and Valibot accept.
	mac: '00:1A:2B:3C:4D:5E',
	// `G` is not a hexadecimal digit.
	invalidMac: '00:1A:2B:3C:4D:5G',
	hostname: 'sub.example.com',
	// A label may not start with a hyphen.
	invalidHostname: '-example.com',
}

const urlSteps = ['string', 'isUrl']
const ipSteps = ['string', 'isIp']
const isoDateSteps = ['string', 'isIsoDate']
const isoTimeSteps = ['string', 'isIsoTime']
const emojiSteps = ['string', 'isEmoji']
const base64Steps = ['string', 'isBase64']
const nanoidSteps = ['string', 'isNanoid']
const ulidSteps = ['string', 'isUlid']
const cuid2Steps = ['string', 'isCuid2']
const jwtSteps = ['string', 'isJwt']
const base64UrlSteps = ['string', 'isBase64Url']
const hexSteps = ['string', 'isHex']
const macSteps = ['string', 'isMac']
const hostnameSteps = ['string', 'isHostname']

// Each library ships its own accepted set for these formats, so the scope is a
// compatible subset, exactly as for the first three formats: the fixtures are
// values every participating implementation accepts, or rejects, alike.
const subset = 'compatible-subset'

export const stringFormatExtendedScenarios = [
	warm('string-format/url-valid', 'standard', 'formatUrl', inputs.url, { success: true, output: inputs.url }, { comparisonScope: subset, steps: urlSteps }),
	warm('string-format/url-invalid', 'full', 'formatUrl', inputs.invalidUrl, { success: false }, { comparisonScope: subset, steps: urlSteps }),
	warm('string-format/ip-valid', 'standard', 'formatIp', inputs.ip, { success: true, output: inputs.ip }, { comparisonScope: subset, requiredFeatures: ['combined IPv4/IPv6'], steps: ipSteps }),
	warm('string-format/ip-invalid', 'full', 'formatIp', inputs.invalidIp, { success: false }, { comparisonScope: subset, requiredFeatures: ['combined IPv4/IPv6'], steps: ipSteps }),
	warm('string-format/iso-date-valid', 'standard', 'formatIsoDate', inputs.isoDate, { success: true, output: inputs.isoDate }, { comparisonScope: subset, steps: isoDateSteps }),
	warm('string-format/iso-date-invalid', 'full', 'formatIsoDate', inputs.invalidIsoDate, { success: false }, { comparisonScope: subset, steps: isoDateSteps }),
	warm('string-format/iso-time-valid', 'standard', 'formatIsoTime', inputs.isoTime, { success: true, output: inputs.isoTime }, { comparisonScope: subset, steps: isoTimeSteps }),
	warm('string-format/iso-time-invalid', 'full', 'formatIsoTime', inputs.invalidIsoTime, { success: false }, { comparisonScope: subset, steps: isoTimeSteps }),
	warm('string-format/emoji-valid', 'standard', 'formatEmoji', inputs.emoji, { success: true, output: inputs.emoji }, { comparisonScope: subset, steps: emojiSteps }),
	warm('string-format/emoji-invalid', 'full', 'formatEmoji', inputs.invalidEmoji, { success: false }, { comparisonScope: subset, steps: emojiSteps }),
	warm('string-format/base64-valid', 'standard', 'formatBase64', inputs.base64, { success: true, output: inputs.base64 }, { comparisonScope: subset, steps: base64Steps }),
	warm('string-format/base64-invalid', 'full', 'formatBase64', inputs.invalidBase64, { success: false }, { comparisonScope: subset, steps: base64Steps }),
	warm('string-format/nanoid-valid', 'standard', 'formatNanoid', inputs.nanoid, { success: true, output: inputs.nanoid }, { comparisonScope: subset, steps: nanoidSteps }),
	warm('string-format/nanoid-invalid', 'full', 'formatNanoid', inputs.invalidNanoid, { success: false }, { comparisonScope: subset, steps: nanoidSteps }),
	warm('string-format/ulid-valid', 'standard', 'formatUlid', inputs.ulid, { success: true, output: inputs.ulid }, { comparisonScope: subset, steps: ulidSteps }),
	warm('string-format/ulid-invalid', 'full', 'formatUlid', inputs.invalidUlid, { success: false }, { comparisonScope: subset, steps: ulidSteps }),
	warm('string-format/cuid2-valid', 'standard', 'formatCuid2', inputs.cuid2, { success: true, output: inputs.cuid2 }, { comparisonScope: subset, steps: cuid2Steps }),
	warm('string-format/cuid2-invalid', 'full', 'formatCuid2', inputs.invalidCuid2, { success: false }, { comparisonScope: subset, steps: cuid2Steps }),
	warm('string-format/jwt-valid', 'standard', 'formatJwt', inputs.jwt, { success: true, output: inputs.jwt }, { comparisonScope: subset, requiredFeatures: ['JWT'], steps: jwtSteps }),
	warm('string-format/jwt-invalid', 'full', 'formatJwt', inputs.invalidJwt, { success: false }, { comparisonScope: subset, requiredFeatures: ['JWT'], steps: jwtSteps }),
	warm('string-format/base64url-valid', 'standard', 'formatBase64Url', inputs.base64Url, { success: true, output: inputs.base64Url }, { comparisonScope: subset, requiredFeatures: ['base64url'], steps: base64UrlSteps }),
	warm('string-format/base64url-invalid', 'full', 'formatBase64Url', inputs.invalidBase64Url, { success: false }, { comparisonScope: subset, requiredFeatures: ['base64url'], steps: base64UrlSteps }),
	warm('string-format/hex-valid', 'standard', 'formatHex', inputs.hex, { success: true, output: inputs.hex }, { comparisonScope: subset, requiredFeatures: ['hex'], steps: hexSteps }),
	warm('string-format/hex-invalid', 'full', 'formatHex', inputs.invalidHex, { success: false }, { comparisonScope: subset, requiredFeatures: ['hex'], steps: hexSteps }),
	warm('string-format/mac-valid', 'standard', 'formatMac', inputs.mac, { success: true, output: inputs.mac }, { comparisonScope: subset, requiredFeatures: ['MAC address'], steps: macSteps }),
	warm('string-format/mac-invalid', 'full', 'formatMac', inputs.invalidMac, { success: false }, { comparisonScope: subset, requiredFeatures: ['MAC address'], steps: macSteps }),
	warm('string-format/hostname-valid', 'standard', 'formatHostname', inputs.hostname, { success: true, output: inputs.hostname }, { comparisonScope: subset, requiredFeatures: ['hostname'], steps: hostnameSteps }),
	warm('string-format/hostname-invalid', 'full', 'formatHostname', inputs.invalidHostname, { success: false }, { comparisonScope: subset, requiredFeatures: ['hostname'], steps: hostnameSteps }),
]
