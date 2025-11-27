/**
 * Test Plan for min.test.ts
 *
 * This file tests the min step plugin implementation in min.ts.
 *
 * Functions to test:
 * - min: The step plugin that checks if the value is greater than or equal to a specified minimum.
 *
 * Test cases:
 * - Valid inputs: Values >= min for numbers, bigints, and lengths.
 * - Invalid inputs: Values < min, fails with 'min:expected_min'.
 * - Edge cases: Zero, negative numbers, equal values.
 * - Custom messages: Using custom message handler to override default message.
 * - Chaining: Chaining with number, bigint, string, and array steps.
 *
 * Coverage goals: Achieve 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { array, bigint, createValchecker, min, number, string } from '../..'

const v = createValchecker({ steps: [number, bigint, string, array, min] })

describe('min step plugin', () => {
	describe('valid inputs', () => {
		it('should pass when number is greater than min', () => {
			const result = v.number()
				.min(10)
				.execute(15)
			expect(result)
				.toEqual({ value: 15 })
		})

		it('should pass when number is equal to min', () => {
			const result = v.number()
				.min(10)
				.execute(10)
			expect(result)
				.toEqual({ value: 10 })
		})

		it('should pass when bigint is greater than min', () => {
			const result = v.bigint()
				.min(10n)
				.execute(15n)
			expect(result)
				.toEqual({ value: 15n })
		})

		it('should pass when bigint is equal to min', () => {
			const result = v.bigint()
				.min(10n)
				.execute(10n)
			expect(result)
				.toEqual({ value: 10n })
		})

		it('should pass when string length is greater than min', () => {
			const result = v.string()
				.min(3)
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should pass when string length is equal to min', () => {
			const result = v.string()
				.min(5)
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should pass when array length is greater than min', () => {
			const result = v.array(v.number())
				.min(2)
				.execute([1, 2, 3])
			expect(result)
				.toEqual({ value: [1, 2, 3] })
		})

		it('should pass when array length is equal to min', () => {
			const result = v.array(v.number())
				.min(3)
				.execute([1, 2, 3])
			expect(result)
				.toEqual({ value: [1, 2, 3] })
		})
	})

	describe('invalid inputs', () => {
		it('should fail when number is less than min', () => {
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

		it('should fail when bigint is less than min', () => {
			const result = v.bigint()
				.min(10n)
				.execute(5n)
			expect(result)
				.toEqual({
					issues: [{
						code: 'min:expected_min',
						message: 'Expected a minimum value of 10.',
						path: [],
						payload: { target: 'bigint', value: 5n, min: 10n },
					}],
				})
		})

		it('should fail when string length is less than min', () => {
			const result = v.string()
				.min(5)
				.execute('hi')
			expect(result)
				.toEqual({
					issues: [{
						code: 'min:expected_min',
						message: 'Expected a minimum length of 5.',
						path: [],
						payload: { target: 'length', value: 'hi', min: 5 },
					}],
				})
		})

		it('should fail when array length is less than min', () => {
			const result = v.array(v.number())
				.min(3)
				.execute([1, 2])
			expect(result)
				.toEqual({
					issues: [{
						code: 'min:expected_min',
						message: 'Expected a minimum length of 3.',
						path: [],
						payload: { target: 'length', value: [1, 2], min: 3 },
					}],
				})
		})
	})

	describe('edge cases', () => {
		it('should handle zero as min', () => {
			const result = v.number()
				.min(0)
				.execute(0)
			expect(result)
				.toEqual({ value: 0 })
		})

		it('should fail when value is less than zero min', () => {
			const result = v.number()
				.min(0)
				.execute(-1)
			expect(result)
				.toEqual({
					issues: [{
						code: 'min:expected_min',
						message: 'Expected a minimum value of 0.',
						path: [],
						payload: { target: 'number', value: -1, min: 0 },
					}],
				})
		})

		it('should handle negative min', () => {
			const result = v.number()
				.min(-10)
				.execute(-5)
			expect(result)
				.toEqual({ value: -5 })
		})

		it('should fail when value is less than negative min', () => {
			const result = v.number()
				.min(-5)
				.execute(-10)
			expect(result)
				.toEqual({
					issues: [{
						code: 'min:expected_min',
						message: 'Expected a minimum value of -5.',
						path: [],
						payload: { target: 'number', value: -10, min: -5 },
					}],
				})
		})
	})

	describe('custom messages', () => {
		it('should use custom message for invalid input', () => {
			const result = v.number()
				.min(10, () => 'Custom error message')
				.execute(5)
			expect(result)
				.toEqual({
					issues: [{
						code: 'min:expected_min',
						message: 'Custom error message',
						path: [],
						payload: { target: 'number', value: 5, min: 10 },
					}],
				})
		})
	})

	describe('chaining', () => {
		it('should chain with number step', () => {
			const result = v.number()
				.min(10)
				.execute(15)
			expect(result)
				.toEqual({ value: 15 })
		})

		it('should chain with bigint step', () => {
			const result = v.bigint()
				.min(10n)
				.execute(15n)
			expect(result)
				.toEqual({ value: 15n })
		})

		it('should chain with string step', () => {
			const result = v.string()
				.min(3)
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should chain with array step', () => {
			const result = v.array(v.number())
				.min(2)
				.execute([1, 2, 3])
			expect(result)
				.toEqual({ value: [1, 2, 3] })
		})
	})
})
