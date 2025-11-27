/**
 * Test Plan for looseNumber.ts
 *
 * This test file covers the `looseNumber` step plugin implementation.
 *
 * Functions and Classes:
 * - looseNumber: The step plugin that checks if the input value is a number (NaN allowed).
 *
 * Input Scenarios:
 * - Valid number inputs including NaN: positive, negative, zero, float, large, Infinity, -Infinity, NaN.
 * - Invalid inputs: string, boolean, null, undefined, object, array, bigint, symbol.
 *
 * Expected Outputs and Behaviors:
 * - Success: Returns the number value.
 * - Failure: Issues with 'looseNumber:expected_number'.
 *
 * Error Handling and Exceptions:
 * - No exceptions; all errors handled via issues.
 *
 * Coverage Goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { check, createValchecker, looseNumber } from '../..'

const v = createValchecker({ steps: [looseNumber, check] })

describe('looseNumber plugin', () => {
	describe('valid inputs (numbers including NaN)', () => {
		it('should pass for positive number', () => {
			const result = v.looseNumber()
				.execute(42)
			expect(result)
				.toEqual({ value: 42 })
		})

		it('should pass for negative number', () => {
			const result = v.looseNumber()
				.execute(-42)
			expect(result)
				.toEqual({ value: -42 })
		})

		it('should pass for zero', () => {
			const result = v.looseNumber()
				.execute(0)
			expect(result)
				.toEqual({ value: 0 })
		})

		it('should pass for float', () => {
			const result = v.looseNumber()
				.execute(3.14)
			expect(result)
				.toEqual({ value: 3.14 })
		})

		it('should pass for large number', () => {
			const result = v.looseNumber()
				.execute(1e10)
			expect(result)
				.toEqual({ value: 1e10 })
		})

		it('should pass for Infinity', () => {
			const result = v.looseNumber()
				.execute(Infinity)
			expect(result)
				.toEqual({ value: Infinity })
		})

		it('should pass for -Infinity', () => {
			const result = v.looseNumber()
				.execute(-Infinity)
			expect(result)
				.toEqual({ value: -Infinity })
		})

		it('should pass for NaN', () => {
			const result = v.looseNumber()
				.execute(Number.NaN)
			expect(result)
				.toEqual({ value: Number.NaN })
		})
	})

	describe('invalid inputs (not numbers)', () => {
		it('should fail for string', () => {
			const result = v.looseNumber()
				.execute('hello')
			expect(result)
				.toEqual({
					issues: [{
						code: 'looseNumber:expected_number',
						message: 'Expected a number (NaN is allowed).',
						path: [],
						payload: { value: 'hello' },
					}],
				})
		})

		it('should fail for boolean', () => {
			const result = v.looseNumber()
				.execute(true)
			expect(result)
				.toEqual({
					issues: [{
						code: 'looseNumber:expected_number',
						message: 'Expected a number (NaN is allowed).',
						path: [],
						payload: { value: true },
					}],
				})
		})

		it('should fail for null', () => {
			const result = v.looseNumber()
				.execute(null)
			expect(result)
				.toEqual({
					issues: [{
						code: 'looseNumber:expected_number',
						message: 'Expected a number (NaN is allowed).',
						path: [],
						payload: { value: null },
					}],
				})
		})

		it('should fail for undefined', () => {
			const result = v.looseNumber()
				.execute(undefined)
			expect(result)
				.toEqual({
					issues: [{
						code: 'looseNumber:expected_number',
						message: 'Expected a number (NaN is allowed).',
						path: [],
						payload: { value: undefined },
					}],
				})
		})

		it('should fail for object', () => {
			const result = v.looseNumber()
				.execute({})
			expect(result)
				.toEqual({
					issues: [{
						code: 'looseNumber:expected_number',
						message: 'Expected a number (NaN is allowed).',
						path: [],
						payload: { value: {} },
					}],
				})
		})

		it('should fail for array', () => {
			const result = v.looseNumber()
				.execute([])
			expect(result)
				.toEqual({
					issues: [{
						code: 'looseNumber:expected_number',
						message: 'Expected a number (NaN is allowed).',
						path: [],
						payload: { value: [] },
					}],
				})
		})

		it('should fail for bigint', () => {
			const result = v.looseNumber()
				.execute(123n)
			expect(result)
				.toEqual({
					issues: [{
						code: 'looseNumber:expected_number',
						message: 'Expected a number (NaN is allowed).',
						path: [],
						payload: { value: 123n },
					}],
				})
		})

		it('should fail for symbol', () => {
			const sym = Symbol('test')
			const result = v.looseNumber()
				.execute(sym)
			expect(result)
				.toEqual({
					issues: [{
						code: 'looseNumber:expected_number',
						message: 'Expected a number (NaN is allowed).',
						path: [],
						payload: { value: sym },
					}],
				})
		})
	})

	describe('custom messages', () => {
		it('should use custom message for invalid input', () => {
			const result = v.looseNumber('Custom error message')
				.execute('hello')
			expect(result)
				.toEqual({
					issues: [{
						code: 'looseNumber:expected_number',
						message: 'Custom error message',
						path: [],
						payload: { value: 'hello' },
					}],
				})
		})
	})

	describe('chaining', () => {
		it('should chain with check', () => {
			const result = v.looseNumber()
				.check(n => !Number.isNaN(n))
				.execute(42)
			expect(result)
				.toEqual({ value: 42 })
		})

		it('should fail chaining with check', () => {
			const result = v.looseNumber()
				.check(n => !Number.isNaN(n))
				.execute(Number.NaN)
			expect(result)
				.toEqual({
					issues: [{
						code: 'check:failed',
						message: 'Check failed',
						path: [],
						payload: { value: Number.NaN },
					}],
				})
		})
	})
})
