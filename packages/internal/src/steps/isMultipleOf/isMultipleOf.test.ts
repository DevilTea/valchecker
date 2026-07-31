import { describe, expect, it } from 'vitest'
import { bigint, createValchecker, isMultipleOf, number } from '../..'

const v = createValchecker({ steps: [bigint, isMultipleOf, number] })

describe('isMultipleOf step plugin', () => {
	it('accepts exact integer, bigint, negative, and ordinary decimal multiples', () => {
		expect(v.number()
			.isMultipleOf(3)
			.execute(12))
			.toEqual({ value: 12 })
		expect(v.number()
			.isMultipleOf(0.1)
			.execute(0.3))
			.toEqual({ value: 0.3 })
		expect(v.number()
			.isMultipleOf(0.1)
			.execute(0.1 + 0.2))
			.toEqual({ value: 0.1 + 0.2 })
		expect(v.number()
			.isMultipleOf(-2)
			.execute(6))
			.toEqual({ value: 6 })
		expect(v.bigint()
			.isMultipleOf(3n)
			.execute(9n))
			.toEqual({ value: 9n })
	})

	it('rejects non-multiples, huge near-quotients, and non-finite values', () => {
		expect(v.number()
			.isMultipleOf(2)
			.execute(3))
			.toMatchObject({
				issues: [{ message: 'Expected a multiple of 2.', payload: { target: 'number', value: 3, divisor: 2 } }],
			})
		expect(v.number()
			.isMultipleOf(0.1)
			.execute(0.31))
			.toMatchObject({
				issues: [{ code: 'isMultipleOf:expected_multiple_of' }],
			})
		expect(v.number()
			.isMultipleOf(3)
			.execute(10_000_000_000_000_000))
			.toMatchObject({
				issues: [{ payload: { target: 'number', value: 10_000_000_000_000_000, divisor: 3 } }],
			})
		expect(v.number()
			.isMultipleOf(2)
			.execute(Infinity))
			.toMatchObject({
				issues: [{ payload: { target: 'number', value: Infinity, divisor: 2 } }],
			})
		expect(v.bigint()
			.isMultipleOf(2n, { message: 'Even bigint required' })
			.execute(3n))
			.toMatchObject({
				issues: [{ message: 'Even bigint required', payload: { target: 'bigint' } }],
			})
	})

	it('includes the documented tolerance boundary and excludes the value past it', () => {
		// The documented tolerance is Number.EPSILON * Math.max(1, |quotient|) * 8,
		// which is exactly 2 ** -49 while |quotient| <= 1. A quotient of 1 - 2 ** -49
		// therefore sits on the boundary, and the next representable step away from 1
		// sits outside it.
		expect(v.number()
			.isMultipleOf(1)
			.execute(1 - 2 ** -49))
			.toEqual({ value: 1 - 2 ** -49 })
		expect(v.number()
			.isMultipleOf(1)
			.execute(1 - 2 ** -49 - 2 ** -53))
			.toMatchObject({
				issues: [{ code: 'isMultipleOf:expected_multiple_of' }],
			})
	})

	it('rejects invalid divisors at schema construction', () => {
		expect(() => v.number()
			.isMultipleOf(0))
			.toThrow('finite and non-zero')
		expect(() => v.number()
			.isMultipleOf(Infinity))
			.toThrow('finite and non-zero')
		expect(() => v.number()
			.isMultipleOf(Number.NaN))
			.toThrow('finite and non-zero')
		expect(() => v.bigint()
			.isMultipleOf(0n))
			.toThrow('must not be zero')
	})
})
