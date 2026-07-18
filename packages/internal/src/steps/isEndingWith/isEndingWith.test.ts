import { describe, expect, it } from 'vitest'
import { createValchecker, isEndingWith, string } from '../..'

const v = createValchecker({ steps: [string, isEndingWith] })

describe('isEndingWith step plugin', () => {
	it('accepts matching suffixes', () => {
		expect(v.string()
			.isEndingWith('.txt')
			.execute('file.txt'))
			.toEqual({ value: 'file.txt' })
	})

	it('rejects non-matching suffixes', () => {
		expect(v.string()
			.isEndingWith('.txt')
			.execute('file.md'))
			.toEqual({
				issues: [{
					code: 'isEndingWith:expected_ending_with',
					category: 'validation',
					message: 'Expected the string to end with ".txt".',
					path: [],
					payload: { value: 'file.md', suffix: '.txt' },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.string()
			.isEndingWith('.txt', { message: 'Custom suffix' })
			.execute('file.md'))
			.toMatchObject({
				issues: [{ message: 'Custom suffix' }],
			})
	})
})
