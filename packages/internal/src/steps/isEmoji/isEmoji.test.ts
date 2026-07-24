import { describe, expect, it } from 'vitest'
import { createValchecker, isEmoji, string } from '../..'

const v = createValchecker({ steps: [string, isEmoji] })

const valid = [
	'😀',
	'👍🏽',
	'👨‍👩‍👧‍👦',
	'🎉🎊',
]

const invalid = [
	'a',
	'1',
	'😀a',
	' ',
	'',
]

describe('isEmoji step plugin', () => {
	it.each(valid)('accepts %o', (input) => {
		expect(v.string()
			.isEmoji()
			.execute(input))
			.toEqual({ value: input })
	})

	it.each(invalid)('rejects %o', (input) => {
		expect(v.string()
			.isEmoji()
			.execute(input))
			.toMatchObject({ issues: [{ code: 'isEmoji:expected_emoji' }] })
	})

	it('reports the owned issue shape', () => {
		expect(v.string()
			.isEmoji()
			.execute('a'))
			.toEqual({
				issues: [{
					code: 'isEmoji:expected_emoji',
					category: 'validation',
					message: 'Expected an emoji.',
					path: [],
					payload: { value: 'a' },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.string()
			.isEmoji({ message: 'Custom' })
			.execute('a'))
			.toMatchObject({ issues: [{ message: 'Custom' }] })
	})
})
