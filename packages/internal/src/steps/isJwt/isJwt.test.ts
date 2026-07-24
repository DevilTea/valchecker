import { describe, expect, it } from 'vitest'
import { createValchecker, isJwt, string } from '../..'

const v = createValchecker({ steps: [string, isJwt] })

const valid = [
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
	// Unsecured JWS: alg "none" with an empty signature segment.
	'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.',
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
