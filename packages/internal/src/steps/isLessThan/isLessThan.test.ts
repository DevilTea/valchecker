import { describe, expect, it } from 'vitest'
import { bigint, createValchecker, isLessThan, number } from '../..'

const v = createValchecker({ steps: [bigint, isLessThan, number] })
describe('isLessThan step plugin', () => {
	it('uses strict native comparison for numbers and bigints', () => {
		expect(v.number()
			.isLessThan(2)
			.execute(1))
			.toEqual({ value: 1 })
		expect(v.bigint()
			.isLessThan(2n)
			.execute(1n))
			.toEqual({ value: 1n })
	})
	it('rejects equal, larger, and NaN values with typed targets', () => {
		expect(v.number()
			.isLessThan(2)
			.execute(2))
			.toMatchObject({ issues: [{ code: 'isLessThan:expected_less_than', message: 'Expected a value less than 2.', payload: { target: 'number', value: 2, maximum: 2 } }] })
		expect(v.bigint()
			.isLessThan(2n, { message: 'Too large' })
			.execute(3n))
			.toMatchObject({ issues: [{ message: 'Too large', payload: { target: 'bigint' } }] })
		expect(v.number()
			.isLessThan(0)
			.execute(Number.NaN))
			.toMatchObject({ issues: [{ code: 'isLessThan:expected_less_than' }] })
	})
	it('accepts a NaN bound and simply never matches', () => {
		// The bound families carry no hidden operand policy: unlike isMultipleOf(),
		// a NaN bound constructs, and every comparison against it is false.
		expect(() => v.number()
			.isLessThan(Number.NaN))
			.not
			.toThrow()
		expect(v.number()
			.isLessThan(Number.NaN)
			.execute(1))
			.toMatchObject({ issues: [{ code: 'isLessThan:expected_less_than', payload: { maximum: Number.NaN } }] })
	})
})
