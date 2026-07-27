import { describe, expect, it } from 'vitest'
import { createValchecker, isJwt, string } from '../..'

const v = createValchecker({ steps: [string, isJwt] })

const valid = [
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
	// Unsecured JWS: alg "none" with an empty signature segment.
	'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.',
	// Segment lengths of 0, 2 and 3 (mod 4) are all valid base64url.
	'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig0',
	'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.si',
	'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig',
]

const invalid = [
	'abc.def',
	'a.b.c.d',
	'eyJ0eXAiOiJKV1QifQ.eyJzdWIiOiJ4In0.sig',
	'YWJj.eyJzdWIiOiJ4In0.sig',
	// Valid header, but a non-empty signature outside the base64url alphabet.
	'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.b@d',
	'a..b',
	'',
	// A segment is base64url, so its length is never 1 (mod 4): a final group of
	// one character cannot encode a byte. The payload and the signature each get
	// a case; a header of that length was already rejected before this rule
	// existed, because it must base64-decode to JSON.
	'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig01',
	'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0AB.sig0',
	// The base64url rule accepts the empty string, so the header and payload
	// carry their own non-emptiness requirement. Without it this token — valid
	// header, empty payload, empty signature — would be accepted.
	'eyJhbGciOiJIUzI1NiJ9..',
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
