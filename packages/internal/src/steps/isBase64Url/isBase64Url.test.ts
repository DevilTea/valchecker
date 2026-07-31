import { describe, expect, it } from 'vitest'
import { createValchecker, isBase64Url, string } from '../..'

const v = createValchecker({ steps: [string, isBase64Url] })

const valid = [
	'aGVsbG8',
	'Zm9vYmFy',
	'ab',
	'',
	// The URL- and filename-safe alphabet: `-` and `_` in place of `+` and `/`.
	// Without these the accepted set would be indistinguishable from base64's.
	'a-b_',
	'-_-_',
	// Lengths of 0, 2 and 3 (mod 4) all encode a whole number of bytes.
	'abc',
	// Non-canonical trailing bits are accepted; see `base64url.ts`.
	'aB',
]

const invalid = [
	'a+b/c',
	'abc=',
	'****',
	'x',
	// 1 (mod 4) is rejected at every length, not only at length 1.
	'abcde',
	// Padding is never part of an unpadded base64url string, wherever it sits.
	'a=b',
	// `$` without the `m` flag is end-of-input, so a trailing newline fails.
	'aGVsbG8\n',
]

describe('isBase64Url step plugin', () => {
	it.each(valid)('accepts %o', (input) => {
		expect(v.string()
			.isBase64Url()
			.execute(input))
			.toEqual({ value: input })
	})

	it.each(invalid)('rejects %o', (input) => {
		expect(v.string()
			.isBase64Url()
			.execute(input))
			.toMatchObject({ issues: [{ code: 'isBase64Url:expected_base64_url' }] })
	})

	it('reports the owned issue shape', () => {
		expect(v.string()
			.isBase64Url()
			.execute('a+b/c'))
			.toEqual({
				issues: [{
					code: 'isBase64Url:expected_base64_url',
					category: 'validation',
					message: 'Expected a valid base64url string.',
					path: [],
					payload: { value: 'a+b/c' },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.string()
			.isBase64Url({ message: 'Custom' })
			.execute('a+b/c'))
			.toMatchObject({ issues: [{ message: 'Custom' }] })
	})
})
