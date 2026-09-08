import { describe, expect, it } from 'vitest'
import { positiveNumber } from './example'

describe('custom-step plugin documentation example', () => {
	it('registers the custom fluent method and preserves successful values', () => {
		expect(positiveNumber.execute(2))
			.toEqual({ value: 2 })
	})

	it('returns the issue contract owned by the custom step', () => {
		const result = positiveNumber.execute(0)
		expect(result)
			.toMatchObject({
				issues: [{
					code: 'isPositive:expected_positive',
					category: 'validation',
					payload: { value: 0 },
				}],
			})
	})
})
