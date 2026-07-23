import { describe, expect, it } from 'vitest'
import { createValchecker, isBase64Url, string } from '../..'

const v = createValchecker({ steps: [string, isBase64Url] })

const valid = [
	'aGVsbG8',
	'Zm9vYmFy',
	'ab',
	'',
]

const invalid = [
	'a+b/c',
	'abc=',
	'****',
	'x',
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
