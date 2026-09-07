import { describe, expect, it } from 'vitest'
import { createValchecker, isJwt, string } from '../..'

const v = createValchecker({ steps: [string, isJwt] })
const textEncoder = new TextEncoder()

function encodeBytes(bytes: Uint8Array): string {
	let binary = ''
	for (let i = 0; i < bytes.length; i++)
		binary += String.fromCharCode(bytes[i]!)
	return btoa(binary)
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '')
}

function encodeJson(value: unknown): string {
	return encodeBytes(textEncoder.encode(JSON.stringify(value)))
}

function token(header: unknown, payload: unknown, signature: string): string {
	return `${encodeJson(header)}.${encodeJson(payload)}.${signature}`
}

function encodeInvalidUtf8Json(prefix: string, suffix: string): string {
	return encodeBytes(Uint8Array.from([
		...textEncoder.encode(prefix),
		0xC0,
		...textEncoder.encode(suffix),
	]))
}

const valid = [
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
	// Unsecured JWS: alg "none" requires an empty signature segment.
	token({ alg: 'none' }, { sub: 'x' }, ''),
	// A Claims Set may be an empty JSON object, `typ: "JWT"` is not required,
	// and an unknown algorithm name is structurally valid when a signature is
	// present. No signature bytes are cryptographically verified.
	token({ alg: 'private-alg', kid: 1 }, {}, 'sig'),
	// UTF-8 JSON is decoded as bytes rather than as atob()'s binary string.
	token({ alg: 'HS256', kid: '金鑰' }, { name: '台灣' }, 'sig'),
	// Segment lengths of 2 and 3 (mod 4) are valid base64url lengths. Signature
	// content is opaque to this structural validator.
	token({ alg: 'HS256' }, { sub: 'x' }, 'si'),
	token({ alg: 'HS256' }, { sub: 'x' }, 'sig'),
	'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
]

const invalid = [
	'abc.def',
	'a.b.c.d',
	// Missing or non-string JOSE `alg`.
	token({ typ: 'JWT' }, { sub: 'x' }, 'sig'),
	token({ alg: 1 }, { sub: 'x' }, 'sig'),
	// `alg` is required to be non-empty.
	token({ alg: '' }, { sub: 'x' }, 'sig'),
	// Header and Claims Set must both be JSON objects, not other JSON values.
	`${encodeJson('nope')}.${encodeJson({ sub: 'x' })}.sig`,
	`${encodeJson(null)}.${encodeJson({ sub: 'x' })}.sig`,
	// Valid UTF-8 that is not JSON at all is rejected independently of the
	// top-level-object check. `YWJj` decodes to the bytes for `abc`.
	`YWJj.${encodeJson({ sub: 'x' })}.sig`,
	`${encodeJson(['HS256'])}.${encodeJson({ sub: 'x' })}.sig`,
	token({ alg: 'HS256' }, 'abc', 'sig'),
	token({ alg: 'HS256' }, null, 'sig'),
	token({ alg: 'HS256' }, ['claims'], 'sig'),
	`${encodeJson({ alg: 'HS256' })}.YWJj.sig`,
	// Both decoded JSON segments must be valid UTF-8. A lone 0xC0 byte inside
	// a JSON string is invalid UTF-8 even though the old binary-string path let
	// JSON.parse treat it as a JavaScript code unit.
	`${encodeInvalidUtf8Json('{"alg":"', '"}')}.${encodeJson({ sub: 'x' })}.sig`,
	`${encodeJson({ alg: 'HS256' })}.${encodeInvalidUtf8Json('{"sub":"', '"}')}.sig`,
	// Signature presence is determined by `alg` exactly: `none` must be empty;
	// every other algorithm name must be non-empty.
	token({ alg: 'none' }, { sub: 'x' }, 'sig'),
	token({ alg: 'HS256' }, { sub: 'x' }, ''),
	// Valid header/payload, but a non-empty signature outside base64url.
	`${encodeJson({ alg: 'HS256' })}.${encodeJson({ sub: 'x' })}.b@d`,
	'a..b',
	'',
	// A segment is base64url, so its length is never 1 (mod 4). The payload
	// and signature each get a direct one-character/five-character case.
	`${encodeJson({ alg: 'HS256' })}.A.sig`,
	`${encodeJson({ alg: 'HS256' })}.${encodeJson({ sub: 'x' })}.sig01`,
	// Header and payload must be non-empty independently of base64url's empty
	// string representation of zero bytes.
	`${encodeJson({ alg: 'HS256' })}..sig`,
	// A header outside the base64url alphabet never reaches decoding.
	`${encodeJson({ alg: 'HS256' })}+.${encodeJson({ sub: 'x' })}.sig`,
	// JWE compact serialization has five segments and is outside isJwt().
	'a.b.c.d.e',
]

describe('isJwt step plugin', () => {
	it.each(valid)('accepts %o', (input) => {
		expect(v.string()
			.isJwt()
			.execute(input))
			.toEqual({ value: input })
	})

	it.each(invalid)('rejects %o', (input) => {
		expect(v.string()
			.isJwt()
			.execute(input))
			.toMatchObject({ issues: [{ code: 'isJwt:expected_jwt' }] })
	})

	it('reports the owned issue shape', () => {
		expect(v.string()
			.isJwt()
			.execute('abc.def'))
			.toEqual({
				issues: [{
					code: 'isJwt:expected_jwt',
					category: 'validation',
					message: 'Expected a valid JWT.',
					path: [],
					payload: { value: 'abc.def' },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.string()
			.isJwt({ message: 'Custom' })
			.execute('abc.def'))
			.toMatchObject({ issues: [{ message: 'Custom' }] })
	})
})
