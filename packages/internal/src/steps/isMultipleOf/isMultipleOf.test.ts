import { describe, expect, it } from 'vitest'
import { bigint, createValchecker, isMultipleOf, number } from '../..'
const v = createValchecker({ steps: [bigint, isMultipleOf, number] })
describe('isMultipleOf step plugin', () => {
	it('accepts number and bigint multiples using JavaScript remainder semantics', () => {
		expect(v.number().isMultipleOf(0.5).execute(1.5)).toEqual({ value: 1.5 })
		expect(v.bigint().isMultipleOf(3n).execute(9n)).toEqual({ value: 9n })
	})
	it('reports non-multiples and supports custom messages', () => {
		expect(v.number().isMultipleOf(2).execute(3)).toMatchObject({ issues: [{ payload: { target: 'number', value: 3, divisor: 2 } }] })
		expect(v.bigint().isMultipleOf(2n, { message: 'Even bigint required' }).execute(3n)).toMatchObject({ issues: [{ message: 'Even bigint required', payload: { target: 'bigint' } }] })
	})
	it('rejects invalid divisors at schema construction', () => {
		expect(() => v.number().isMultipleOf(0)).toThrow('finite and non-zero')
		expect(() => v.number().isMultipleOf(Infinity)).toThrow('finite and non-zero')
		expect(() => v.bigint().isMultipleOf(0n)).toThrow('must not be zero')
	})
})
