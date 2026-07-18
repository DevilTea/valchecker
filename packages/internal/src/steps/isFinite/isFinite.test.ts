import { describe, expect, it } from 'vitest'
import { createValchecker, isFinite, number } from '../..'

const v = createValchecker({ steps: [number, isFinite] })

describe('isFinite step plugin', () => {
	it.each([0, -1, 1.5])('accepts finite number %s', (value) => {
		expect(v.number()
			.isFinite()
			.execute(value))
			.toEqual({ value })
	})

	it.each([Number.NaN, Infinity, -Infinity])('rejects %s', (value) => {
		expect(v.number()
			.isFinite()
			.execute(value))
			.toEqual({
				issues: [{
					code: 'isFinite:expected_finite',
					category: 'validation',
					message: 'Expected a finite number.',
					path: [],
					payload: { value },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.number()
			.isFinite({ message: 'Custom finite' })
			.execute(Infinity))
			.toMatchObject({
				issues: [{ message: 'Custom finite' }],
			})
	})
})
