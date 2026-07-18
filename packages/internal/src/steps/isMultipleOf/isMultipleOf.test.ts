import { describe, expect, it } from 'vitest'
import { bigint, createValchecker, isMultipleOf, number } from '../..'

const v = createValchecker({ steps: [bigint, isMultipleOf, number] })

describe('isMultipleOf step plugin', () => {
	it('accepts exact integer, bigint, negative, and ordinary decimal multiples', () => {
		expect(v.number().isMultipleOf(3).execute(12)).toEqual({ value: 12 })
		expect(v.number().isMultipleOf(0.1).execute(0.3)).toEqual({ value: 0.3 })
		expect(v.number().isMultipleOf(0.1).execute(0.1 + 0.2)).toEqual({ value: 0.1 + 0.2 })
		expect(v.number().isMultipleOf(-2).execute(6)).toEqual({ value: 6 })
		expect(v.bigint().isMultipleOf(3n).execute(9n)).toEqual({ value: 9n })
	})

	it('rejects non-multiples, huge near-quotients, and non-finite values', () => {
		expect(v.number().isMultipleOf(2).execute(3)).toMatchObject({
			issues: [{ payload: { target: 'number', value: 3, divisor: 2 } }],
		})
		expect(v.number().isMultipleOf(0.1).execute(0.31)).toMatchObject({
			issues: [{ code: 'isMultipleOf:expected_multiple_of' }],
		})
		expect(v.number().isMultipleOf(3).execute(10_000_000_000_000_000)).toMatchObject({
			issues: [{ payload: { target: 'number', value: 10_000_000_000_000_000, divisor: 3 } }],
		})
		expect(v.number().isMultipleOf(2).execute(Infinity)).toMatchObject({
			issues: [{ payload: { target: 'number', value: Infinity, divisor: 2 } }],
		})
		expect(v.bigint().isMultipleOf(2n, { message: 'Even bigint required' }).execute(3n)).toMatchObject({
			issues: [{ message: 'Even bigint required', payload: { target: 'bigint' } }],
		})
	})

	it('rejects invalid divisors at schema construction', () => {
		expect(() => v.number().isMultipleOf(0)).toThrow('finite and non-zero')
		expect(() => v.number().isMultipleOf(Infinity)).toThrow('finite and non-zero')
		expect(() => v.bigint().isMultipleOf(0n)).toThrow('must not be zero')
	})
})