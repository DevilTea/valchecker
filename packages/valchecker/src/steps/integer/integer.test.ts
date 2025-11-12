/**
 * Test Plan for integer.test.ts
 *
 * This file tests the integer step plugin implementation in integer.ts.
 *
 * Functions to test:
 * - integer: The step plugin that checks if the value is an integer.
 *
 * Test cases:
 * - Valid inputs: Integer numbers (positive, negative, zero).
 * - Invalid inputs: Non-integer numbers (floats, NaN, infinity), non-numbers.
 * - Edge cases: Large integers, boundary values.
 * - Custom messages: Using custom message handler to override default message.
 * - Chaining: Chaining with number step.
 *
 * Coverage goals: Achieve 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { createValchecker, integer, number } from '../..'

const v = createValchecker({ steps: [number, integer] })

describe('integer step plugin', () => {
	describe('valid inputs', () => {
		it('should pass for positive integers', () => {
			const result = v.number()
				.integer()
				.execute(42)
			expect(result).toEqual({ value: 42 })
		})

		it('should pass for negative integers', () => {
			const result = v.number()
				.integer()
				.execute(-7)
			expect(result).toEqual({ value: -7 })
		})

		it('should pass for zero', () => {
			const result = v.number()
				.integer()
				.execute(0)
			expect(result).toEqual({ value: 0 })
		})

		it('should pass for large positive integers', () => {
			const result = v.number()
				.integer()
				.execute(1000000)
			expect(result).toEqual({ value: 1000000 })
		})

		it('should pass for large negative integers', () => {
			const result = v.number()
				.integer()
				.execute(-999999)
			expect(result).toEqual({ value: -999999 })
		})
	})

	describe('invalid inputs', () => {
		it('should fail for floating-point numbers', () => {
			const result = v.number()
				.integer()
				.execute(3.14)
			expect(result).toEqual({
				issues: [{
					code: 'integer:expected_integer',
					payload: { value: 3.14 },
					message: 'Expected an integer.',
				}],
			})
		})

		it('should fail for negative floating-point numbers', () => {
			const result = v.number()
				.integer()
				.execute(-2.5)
			expect(result).toEqual({
				issues: [{
					code: 'integer:expected_integer',
					payload: { value: -2.5 },
					message: 'Expected an integer.',
				}],
			})
		})

		it('should fail for NaN', () => {
			const result = v.number()
				.integer()
				.execute(Number.NaN)
			expect(result).toEqual({
				issues: [{
					code: 'number:expected_number',
					payload: { value: Number.NaN },
					message: 'Expected a number (NaN is not allowed).',
				}],
			})
		})

		it('should fail for positive infinity', () => {
			const result = v.number()
				.integer()
				.execute(Infinity)
			expect(result).toEqual({
				issues: [{
					code: 'integer:expected_integer',
					payload: { value: Infinity },
					message: 'Expected an integer.',
				}],
			})
		})

		it('should fail for negative infinity', () => {
			const result = v.number()
				.integer()
				.execute(-Infinity)
			expect(result).toEqual({
				issues: [{
					code: 'integer:expected_integer',
					payload: { value: -Infinity },
					message: 'Expected an integer.',
				}],
			})
		})

		it('should fail for strings', () => {
			const result = v.number()
				.integer()
				.execute('42')
			expect(result).toEqual({
				issues: [{
					code: 'number:expected_number',
					payload: { value: '42' },
					message: 'Expected a number (NaN is not allowed).',
				}],
			})
		})

		it('should fail for boolean true', () => {
			const result = v.number()
				.integer()
				.execute(true)
			expect(result).toEqual({
				issues: [{
					code: 'number:expected_number',
					payload: { value: true },
					message: 'Expected a number (NaN is not allowed).',
				}],
			})
		})

		it('should fail for boolean false', () => {
			const result = v.number()
				.integer()
				.execute(false)
			expect(result).toEqual({
				issues: [{
					code: 'number:expected_number',
					payload: { value: false },
					message: 'Expected a number (NaN is not allowed).',
				}],
			})
		})

		it('should fail for objects', () => {
			const result = v.number()
				.integer()
				.execute({})
			expect(result).toEqual({
				issues: [{
					code: 'number:expected_number',
					payload: { value: {} },
					message: 'Expected a number (NaN is not allowed).',
				}],
			})
		})

		it('should fail for arrays', () => {
			const result = v.number()
				.integer()
				.execute([])
			expect(result).toEqual({
				issues: [{
					code: 'number:expected_number',
					payload: { value: [] },
					message: 'Expected a number (NaN is not allowed).',
				}],
			})
		})

		it('should fail for null', () => {
			const result = v.number()
				.integer()
				.execute(null)
			expect(result).toEqual({
				issues: [{
					code: 'number:expected_number',
					payload: { value: null },
					message: 'Expected a number (NaN is not allowed).',
				}],
			})
		})

		it('should fail for undefined', () => {
			const result = v.number()
				.integer()
				.execute(undefined)
			expect(result).toEqual({
				issues: [{
					code: 'number:expected_number',
					payload: { value: undefined },
					message: 'Expected a number (NaN is not allowed).',
				}],
			})
		})

		it('should fail for symbols', () => {
			const sym = Symbol('test')
			const result = v.number()
				.integer()
				.execute(sym)
			expect(result).toEqual({
				issues: [{
					code: 'number:expected_number',
					payload: { value: sym },
					message: 'Expected a number (NaN is not allowed).',
				}],
			})
		})

		it('should fail for bigints', () => {
			const result = v.number()
				.integer()
				.execute(42n)
			expect(result).toEqual({
				issues: [{
					code: 'number:expected_number',
					payload: { value: 42n },
					message: 'Expected a number (NaN is not allowed).',
				}],
			})
		})
	})

	describe('edge cases', () => {
		it('should handle Number.MAX_SAFE_INTEGER', () => {
			const result = v.number()
				.integer()
				.execute(Number.MAX_SAFE_INTEGER)
			expect(result).toEqual({ value: Number.MAX_SAFE_INTEGER })
		})

		it('should handle Number.MIN_SAFE_INTEGER', () => {
			const result = v.number()
				.integer()
				.execute(Number.MIN_SAFE_INTEGER)
			expect(result).toEqual({ value: Number.MIN_SAFE_INTEGER })
		})
	})

	describe('custom messages', () => {
		it('should use custom message for invalid input', () => {
			const result = v.number()
				.integer(() => 'Custom error message')
				.execute(3.14)
			expect(result).toEqual({
				issues: [{
					code: 'integer:expected_integer',
					payload: { value: 3.14 },
					message: 'Custom error message',
				}],
			})
		})
	})

	describe('chaining', () => {
		it('should chain with number step', () => {
			const result = v.number()
				.integer()
				.execute(42)
			expect(result).toEqual({ value: 42 })
		})
	})
})
