import { describe, expect, it } from 'vitest'
import { createValchecker, isNaN, number } from '../..'

const v = createValchecker({ steps: [number, isNaN] })

describe('isNaN step plugin', () => {
	it('accepts NaN', () => {
		expect(v.number()
			.isNaN()
			.execute(Number.NaN))
			.toEqual({ value: Number.NaN })
	})

	it.each([0, Infinity, -Infinity])('rejects %s', (value) => {
		expect(v.number()
			.isNaN()
			.execute(value))
			.toEqual({
				issues: [{
					code: 'isNaN:expected_nan',
					category: 'validation',
					message: 'Expected NaN.',
					path: [],
					payload: { value },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.number()
			.isNaN({ message: 'Custom NaN' })
			.execute(0))
			.toMatchObject({
				issues: [{ message: 'Custom NaN' }],
			})
	})
})
