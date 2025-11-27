/**
 * Test Plan for max.test.ts
 *
 * This file tests the max step plugin implementation in max.ts.
 *
 * Functions to test:
 * - max: The step plugin that checks if the value is less than or equal to a specified maximum.
 *
 * Test cases:
 * - Valid inputs: Values <= max for numbers, bigints, and lengths.
 * - Invalid inputs: Values > max, fails with 'max:expected_max'.
 * - Edge cases: Zero, negative numbers, equal values.
 * - Custom messages: Using custom message handler to override default message.
 * - Chaining: Chaining with number, bigint, string, and array steps.
 *
 * Coverage goals: Achieve 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { array, bigint, createValchecker, max, number, string } from '../..'

const v = createValchecker({ steps: [number, bigint, string, array, max] })

describe('max step plugin', () => {
	describe('valid inputs', () => {
		it('should pass when number is less than max', () => {
			const result = v.number()
				.max(10)
				.execute(5)
			expect(result)
				.toEqual({ value: 5 })
		})

		it('should pass when number is equal to max', () => {
			const result = v.number()
				.max(10)
				.execute(10)
			expect(result)
				.toEqual({ value: 10 })
		})

		it('should pass when bigint is less than max', () => {
			const result = v.bigint()
				.max(10n)
				.execute(5n)
			expect(result)
				.toEqual({ value: 5n })
		})

		it('should pass when bigint is equal to max', () => {
			const result = v.bigint()
				.max(10n)
				.execute(10n)
			expect(result)
				.toEqual({ value: 10n })
		})

		it('should pass when string length is less than max', () => {
			const result = v.string()
				.max(5)
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should pass when string length is equal to max', () => {
			const result = v.string()
				.max(5)
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should pass when array length is less than max', () => {
			const result = v.array(v.number())
				.max(3)
				.execute([1, 2])
			expect(result)
				.toEqual({ value: [1, 2] })
		})

		it('should pass when array length is equal to max', () => {
			const result = v.array(v.number())
				.max(3)
				.execute([1, 2, 3])
			expect(result)
				.toEqual({ value: [1, 2, 3] })
		})
	})

	describe('invalid inputs', () => {
		it('should fail when number is greater than max', () => {
			const result = v.number()
				.max(10)
				.execute(15)
			expect(result)
				.toEqual({
					issues: [{
						code: 'max:expected_max',
						message: 'Expected a maximum value of 10.',
						path: [],
						payload: { target: 'number', value: 15, max: 10 },
					}],
				})
		})

		it('should fail when bigint is greater than max', () => {
			const result = v.bigint()
				.max(10n)
				.execute(15n)
			expect(result)
				.toEqual({
					issues: [{
						code: 'max:expected_max',
						message: 'Expected a maximum value of 10.',
						path: [],
						payload: { target: 'bigint', value: 15n, max: 10n },
					}],
				})
		})

		it('should fail when string length is greater than max', () => {
			const result = v.string()
				.max(5)
				.execute('hello world')
			expect(result)
				.toEqual({
					issues: [{
						code: 'max:expected_max',
						message: 'Expected a maximum length of 5.',
						path: [],
						payload: { target: 'length', value: 'hello world', max: 5 },
					}],
				})
		})

		it('should fail when array length is greater than max', () => {
			const result = v.array(v.number())
				.max(3)
				.execute([1, 2, 3, 4])
			expect(result)
				.toEqual({
					issues: [{
						code: 'max:expected_max',
						message: 'Expected a maximum length of 3.',
						path: [],
						payload: { target: 'length', value: [1, 2, 3, 4], max: 3 },
					}],
				})
		})
	})

	describe('edge cases', () => {
		it('should handle zero as max', () => {
			const result = v.number()
				.max(0)
				.execute(0)
			expect(result)
				.toEqual({ value: 0 })
		})

		it('should fail when value is greater than zero max', () => {
			const result = v.number()
				.max(0)
				.execute(1)
			expect(result)
				.toEqual({
					issues: [{
						code: 'max:expected_max',
						message: 'Expected a maximum value of 0.',
						path: [],
						payload: { target: 'number', value: 1, max: 0 },
					}],
				})
		})

		it('should handle negative max', () => {
			const result = v.number()
				.max(-5)
				.execute(-10)
			expect(result)
				.toEqual({ value: -10 })
		})

		it('should fail when value is greater than negative max', () => {
			const result = v.number()
				.max(-5)
				.execute(0)
			expect(result)
				.toEqual({
					issues: [{
						code: 'max:expected_max',
						message: 'Expected a maximum value of -5.',
						path: [],
						payload: { target: 'number', value: 0, max: -5 },
					}],
				})
		})
	})

	describe('custom messages', () => {
		it('should use custom message for invalid input', () => {
			const result = v.number()
				.max(10, () => 'Custom error message')
				.execute(15)
			expect(result)
				.toEqual({
					issues: [{
						code: 'max:expected_max',
						message: 'Custom error message',
						path: [],
						payload: { target: 'number', value: 15, max: 10 },
					}],
				})
		})
	})

	describe('chaining', () => {
		it('should chain with number step', () => {
			const result = v.number()
				.max(10)
				.execute(5)
			expect(result)
				.toEqual({ value: 5 })
		})

		it('should chain with bigint step', () => {
			const result = v.bigint()
				.max(10n)
				.execute(5n)
			expect(result)
				.toEqual({ value: 5n })
		})

		it('should chain with string step', () => {
			const result = v.string()
				.max(5)
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should chain with array step', () => {
			const result = v.array(v.number())
				.max(3)
				.execute([1, 2])
			expect(result)
				.toEqual({ value: [1, 2] })
		})
	})
})
