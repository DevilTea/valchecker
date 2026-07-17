import { describe, expect, it } from 'vitest'
import { createValchecker, isInteger, number } from '../..'

const v = createValchecker({ steps: [number, isInteger] })

describe('isInteger step plugin', () => {
	it.each([0, -1, 42])('accepts integer %s', (value) => {
		expect(v.number().isInteger().execute(value)).toEqual({ value })
	})

	it.each([1.5, Number.NaN, Infinity])('rejects %s', (value) => {
		expect(v.number().isInteger().execute(value)).toEqual({
			issues: [{
				code: 'isInteger:expected_integer',
				message: 'Expected an integer.',
				path: [],
				payload: { value },
			}],
		})
	})

	it('supports custom messages', () => {
		expect(v.number().isInteger('Custom integer').execute(1.5)).toMatchObject({
			issues: [{ message: 'Custom integer' }],
		})
	})
})
