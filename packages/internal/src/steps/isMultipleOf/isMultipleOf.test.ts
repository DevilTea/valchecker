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

	it.each([
		[8192.04, 0.01],
		[131072.05, 0.05],
		[262144.1, 0.1],
	] as const)('accepts %d as a floating-point multiple of %d at a larger quotient', (value, divisor) => {
		expect(v.number()
			.isMultipleOf(divisor)
			.execute(value))
			.toEqual({ value })
	})

	it('rejects ordinary non-multiples and non-finite values', () => {
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
			.execute(1_000_000_000_000))
			.toMatchObject({
				issues: [{ payload: { target: 'number', value: 1_000_000_000_000, divisor: 3 } }],
			})
		expect(v.number()
			.isMultipleOf(1e-300)
			.execute(Number.MAX_VALUE))
			.toMatchObject({
				issues: [{ payload: { target: 'number', value: Number.MAX_VALUE, divisor: 1e-300 } }],
			})
		const overflowValue = Number.MAX_VALUE * 0.9
		const overflowDivisor = Number.MAX_VALUE * 0.55
		expect(v.number()
			.isMultipleOf(overflowDivisor)
			.execute(overflowValue))
			.toMatchObject({
				issues: [{ payload: { target: 'number', value: overflowValue, divisor: overflowDivisor } }],
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
		// With divisor 1 the nearest reconstructed multiple is 1, so the documented
		// value-space tolerance is Number.EPSILON * max(1, |value|, 1) * 8 = 2 ** -49.
		// A value of 1 - 2 ** -49 sits on that boundary; the next representable step
		// farther from 1 sits outside it.
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
