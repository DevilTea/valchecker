/**
 * Test plan for number step:
 * - Functions tested: number validation with optional custom messages.
 * - Valid inputs: numbers excluding NaN (positive, negative, zero, floats, Infinity, -Infinity).
 * - Invalid inputs: NaN, non-number types (string, boolean, null, undefined, object, array, bigint, symbol).
 * - Edge cases: Infinity, -Infinity, large numbers, floats.
 * - Expected behaviors: Success returns { value: number }; failure returns { issues: [{ code: 'number:expected_number', payload: { value }, message }] }.
 * - Error handling: No exceptions; all errors via issues.
 * - Coverage goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { createValchecker, min, number } from '../..'

const v = createValchecker({ steps: [number, min] })

describe('number plugin', () => {
	describe('valid inputs', () => {
		it('should pass for positive number', () => {
			const result = v.number()
				.execute(42)
			expect(result)
				.toEqual({ value: 42 })
		})

		it('should pass for negative number', () => {
			const result = v.number()
				.execute(-42)
			expect(result)
				.toEqual({ value: -42 })
		})

		it('should pass for zero', () => {
			const result = v.number()
				.execute(0)
			expect(result)
				.toEqual({ value: 0 })
		})

		it('should pass for float', () => {
			const result = v.number()
				.execute(3.14)
			expect(result)
				.toEqual({ value: 3.14 })
		})

		it('should pass for large number', () => {
			const result = v.number()
				.execute(1e10)
			expect(result)
				.toEqual({ value: 1e10 })
		})

		it('should pass for Infinity', () => {
			const result = v.number()
				.execute(Infinity)
			expect(result)
				.toEqual({ value: Infinity })
		})

		it('should pass for -Infinity', () => {
			const result = v.number()
				.execute(-Infinity)
			expect(result)
				.toEqual({ value: -Infinity })
		})
	})

	describe('invalid inputs', () => {
		it('should fail for NaN', () => {
			const result = v.number()
				.execute(Number.NaN)
			expect(result)
				.toEqual({
					issues: [{
						code: 'number:expected_number',
						message: 'Expected a number (NaN is not allowed).',
						path: [],
						payload: { value: Number.NaN },
					}],
				})
		})

		it('should fail for string', () => {
			const result = v.number()
				.execute('hello')
			expect(result)
				.toEqual({
					issues: [{
						code: 'number:expected_number',
						message: 'Expected a number (NaN is not allowed).',
						path: [],
						payload: { value: 'hello' },
					}],
				})
		})

		it('should fail for boolean', () => {
			const result = v.number()
				.execute(true)
			expect(result)
				.toEqual({
					issues: [{
						code: 'number:expected_number',
						message: 'Expected a number (NaN is not allowed).',
						path: [],
						payload: { value: true },
					}],
				})
		})

		it('should fail for null', () => {
			const result = v.number()
				.execute(null)
			expect(result)
				.toEqual({
					issues: [{
						code: 'number:expected_number',
						message: 'Expected a number (NaN is not allowed).',
						path: [],
						payload: { value: null },
					}],
				})
		})

		it('should fail for undefined', () => {
			const result = v.number()
				.execute(undefined)
			expect(result)
				.toEqual({
					issues: [{
						code: 'number:expected_number',
						message: 'Expected a number (NaN is not allowed).',
						path: [],
						payload: { value: undefined },
					}],
				})
		})

		it('should fail for object', () => {
			const result = v.number()
				.execute({})
			expect(result)
				.toEqual({
					issues: [{
						code: 'number:expected_number',
						message: 'Expected a number (NaN is not allowed).',
						path: [],
						payload: { value: {} },
					}],
				})
		})

		it('should fail for array', () => {
			const result = v.number()
				.execute([])
			expect(result)
				.toEqual({
					issues: [{
						code: 'number:expected_number',
						message: 'Expected a number (NaN is not allowed).',
						path: [],
						payload: { value: [] },
					}],
				})
		})

		it('should fail for bigint', () => {
			const result = v.number()
				.execute(123n)
			expect(result)
				.toEqual({
					issues: [{
						code: 'number:expected_number',
						message: 'Expected a number (NaN is not allowed).',
						path: [],
						payload: { value: 123n },
					}],
				})
		})

		it('should fail for symbol', () => {
			const sym = Symbol('test')
			const result = v.number()
				.execute(sym)
			expect(result)
				.toEqual({
					issues: [{
						code: 'number:expected_number',
						message: 'Expected a number (NaN is not allowed).',
						path: [],
						payload: { value: sym },
					}],
				})
		})
	})

	describe('custom messages', () => {
		it('should use custom message for invalid input', () => {
			const result = v.number('Custom error message')
				.execute('hello')
			expect(result)
				.toEqual({
					issues: [{
						code: 'number:expected_number',
						message: 'Custom error message',
						path: [],
						payload: { value: 'hello' },
					}],
				})
		})
	})

	describe('chaining', () => {
		it('should chain with min', () => {
			const result = v.number()
				.min(10)
				.execute(15)
			expect(result)
				.toEqual({ value: 15 })
		})

		it('should fail chaining with min', () => {
			const result = v.number()
				.min(10)
				.execute(5)
			expect(result)
				.toEqual({
					issues: [{
						code: 'min:expected_min',
						message: 'Expected a minimum value of 10.',
						path: [],
						payload: { target: 'number', value: 5, min: 10 },
					}],
				})
		})
	})
})
