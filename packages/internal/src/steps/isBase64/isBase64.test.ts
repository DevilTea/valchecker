import { describe, expect, it } from 'vitest'
import { createValchecker, isBase64, string } from '../..'

const v = createValchecker({ steps: [string, isBase64] })

const valid = [
	'aGVsbG8=',
	'Zm9vYmFy',
	'Zg==',
	'',
]

const invalid = [
	'aGVsbG8',
	'=abc',
	'a===',
	'****',
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
