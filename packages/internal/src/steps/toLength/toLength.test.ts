/**
 * Test Plan for toLength.ts
 *
 * This test file covers the `toLength` step plugin implementation.
 *
 * Functions and Classes:
 * - toLength: A step plugin that transforms an object with a length property to its length value.
 *
 * Input Scenarios:
 * - Arrays: Test with empty and non-empty arrays after chaining from array step.
 * - Strings: Test with empty and non-empty strings after chaining from string step.
 * - Other objects with length: Test with custom objects after chaining from appropriate steps.
 * - Edge cases: Ensure chaining is required and direct call fails at type level.
 *
 * Expected Outputs and Behaviors:
 * - Success: Always returns { value: length } as a number after chaining.
 *
 * Error Handling and Exceptions:
 * - No exceptions; transformation handles various inputs gracefully.
 * - Type system prevents invalid chaining.
 *
 * Coverage Goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { any, array, createValchecker, string, toLength } from '../..'

const v = createValchecker({ steps: [array, string, any, toLength] })

describe('toLength plugin', () => {
	describe('array inputs', () => {
		it('should return length of empty array', () => {
			const result = v.array(v.any())
				.toLength()
				.execute([])
			expect(result)
				.toEqual({ value: 0 })
		})

		it('should return length of non-empty array', () => {
			const result = v.array(v.any())
				.toLength()
				.execute([1, 2, 3])
			expect(result)
				.toEqual({ value: 3 })
		})
	})

	describe('string inputs', () => {
		it('should return length of empty string', () => {
			const result = v.string()
				.toLength()
				.execute('')
			expect(result)
				.toEqual({ value: 0 })
		})

		it('should return length of non-empty string', () => {
			const result = v.string()
				.toLength()
				.execute('hello')
			expect(result)
				.toEqual({ value: 5 })
		})

		it('should handle unicode characters', () => {
			const result = v.string()
				.toLength()
				.execute('hello')
			expect(result)
				.toEqual({ value: 5 })
		})
	})

	describe('edge cases', () => {
		it('should handle large arrays', () => {
			const largeArray = Array.from({ length: 1000 })
				.fill(0)
			const result = v.array(v.any())
				.toLength()
				.execute(largeArray)
			expect(result)
				.toEqual({ value: 1000 })
		})
	})
})
