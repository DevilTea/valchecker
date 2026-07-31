import { describe, expect, it } from 'vitest'
import { createValchecker, isBase64, string } from '../..'

const v = createValchecker({ steps: [string, isBase64] })

const valid = [
	'aGVsbG8=',
	'Zm9vYmFy',
	'Zg==',
	'',
	// Both padded final groups: three characters plus one `=`, and two plus
	// two. `Zg==` above covers the second; `aGk=` covers the first.
	'aGk=',
	// `+` and `/` are the standard alphabet's last two characters — the pair
	// `isBase64Url()` replaces with `-` and `_`.
	'a+/b',
	// Non-canonical trailing bits are accepted: canonical base64 of one byte
	// requires the second character in `[AQgw]`. RFC 4648 §3.5 permits either
	// choice, and `isBase64Url()` is permissive the same way.
	'aB==',
]

const invalid = [
	'aGVsbG8',
	'=abc',
	'a===',
	'****',
	// The base64url alphabet is not the standard one.
	'a-b_',
	// Padding closes the string: it may not appear mid-way, and a full group of
	// four cannot be followed by a stray `=`.
	'ab==cd==',
	'YWJj=',
	'====',
	// No whitespace is skipped, and `$` without the `m` flag is end-of-input,
	// so a trailing newline fails.
	'aGVs bG8=',
	'aGVsbG8=\n',
]

describe('isBase64 step plugin', () => {
	it.each(valid)('accepts %o', (input) => {
		expect(v.string()
			.isBase64()
			.execute(input))
			.toEqual({ value: input })
	})

	it.each(invalid)('rejects %o', (input) => {
		expect(v.string()
			.isBase64()
			.execute(input))
			.toMatchObject({ issues: [{ code: 'isBase64:expected_base64' }] })
	})

	it('reports the owned issue shape', () => {
		expect(v.string()
			.isBase64()
			.execute('****'))
			.toEqual({
				issues: [{
					code: 'isBase64:expected_base64',
					category: 'validation',
					message: 'Expected a valid base64 string.',
					path: [],
					payload: { value: '****' },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.string()
			.isBase64({ message: 'Custom' })
			.execute('****'))
			.toMatchObject({ issues: [{ message: 'Custom' }] })
	})
})
