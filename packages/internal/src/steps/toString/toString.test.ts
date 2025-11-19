/**
 * Test Plan for toString.ts
 *
 * This test file covers the `toString` step plugin implementation.
 *
 * Functions and Classes:
 * - toString: A step plugin that converts the input value to its string representation using toString().
 *
 * Input Scenarios:
 * - Valid inputs: All types (number, boolean, string, array, object, bigint, symbol, null, undefined).
 * - Invalid inputs: None (always succeeds).
 * - Edge cases: Custom toString method, various primitive and object types.
 *
 * Expected Outputs and Behaviors:
 * - Success: Always returns { value: stringRepresentation }.
 *
 * Error Handling and Exceptions:
 * - No exceptions; toString is a standard method available on all objects.
 *
 * Coverage Goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { any, createValchecker, toString } from '../..'

const v = createValchecker({ steps: [any, toString] })

describe('toString plugin', () => {
	describe('valid inputs', () => {
		it('should convert number to string', () => {
			const result = v.any()
				.toString()
				.execute(42)
			expect(result)
				.toEqual({ value: '42' })
		})

		it('should convert boolean to string', () => {
			const result = v.any()
				.toString()
				.execute(true)
			expect(result)
				.toEqual({ value: 'true' })
		})

		it('should convert string to string (no change)', () => {
			const result = v.any()
				.toString()
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should convert array to string', () => {
			const result = v.any()
				.toString()
				.execute([1, 2, 3])
			expect(result)
				.toEqual({ value: '1,2,3' })
		})

		it('should convert object to string', () => {
			const result = v.any()
				.toString()
				.execute({ a: 1 })
			expect(result)
				.toEqual({ value: '[object Object]' })
		})

		it('should convert bigint to string', () => {
			const result = v.any()
				.toString()
				.execute(123n)
			expect(result)
				.toEqual({ value: '123' })
		})

		it('should convert symbol to string', () => {
			const result = v.any()
				.toString()
				.execute(Symbol('test'))
			expect(result)
				.toEqual({ value: 'Symbol(test)' })
		})
	})

	describe('edge cases', () => {
		it('should handle custom toString method', () => {
			const obj = {
				value: 123,
				toString: () => 'custom string',
			}
			const result = v.any()
				.toString()
				.execute(obj)
			expect(result)
				.toEqual({ value: 'custom string' })
		})

		it('should handle empty array', () => {
			const result = v.any()
				.toString()
				.execute([])
			expect(result)
				.toEqual({ value: '' })
		})

		it('should handle empty object', () => {
			const result = v.any()
				.toString()
				.execute({})
			expect(result)
				.toEqual({ value: '[object Object]' })
		})
	})
})
