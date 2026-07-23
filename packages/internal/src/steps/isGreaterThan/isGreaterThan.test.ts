import { describe, expect, it } from 'vitest'
import { bigint, createValchecker, isGreaterThan, number } from '../..'

const v = createValchecker({ steps: [bigint, isGreaterThan, number] })
describe('isGreaterThan step plugin', () => {
	it('uses strict native comparison for numbers and bigints', () => {
		expect(v.number()
			.isGreaterThan(1)
			.execute(2))
			.toEqual({ value: 2 })
		expect(v.bigint()
			.isGreaterThan(1n)
			.execute(2n))
			.toEqual({ value: 2n })
	})
	it('rejects equal, smaller, and NaN values with typed targets', () => {
		expect(v.number()
			.isGreaterThan(1)
			.execute(1))
			.toMatchObject({ issues: [{ code: 'isGreaterThan:expected_greater_than', payload: { target: 'number', value: 1, minimum: 1 } }] })
		expect(v.bigint()
			.isGreaterThan(1n, { message: 'Too small' })
			.execute(0n))
			.toMatchObject({ issues: [{ message: 'Too small', payload: { target: 'bigint' } }] })
		expect(v.number()
			.isGreaterThan(0)
			.execute(Number.NaN))
			.toMatchObject({ issues: [{ code: 'isGreaterThan:expected_greater_than' }] })
	})
})
