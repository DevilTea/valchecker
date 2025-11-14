/**
 * Test Plan for toSplitted.ts
 *
 * This test file covers the `toSplitted` step plugin implementation.
 *
 * Functions and Classes:
 * - toSplitted: A step plugin that splits a string using split method.
 *
 * Input Scenarios:
 * - Strings with single separator: Split into array.
 * - Strings with multiple separators: Handle correctly.
 * - Empty strings: Should return array with empty string.
 * - Strings without separator: Should return array with whole string.
 * - With limit parameter: Limit number of splits.
 * - Regex separators: Test with regex.
 *
 * Expected Outputs and Behaviors:
 * - Success: Returns { value: arrayOfSplitParts }.
 *
 * Error Handling and Exceptions:
 * - No exceptions; split handles various inputs gracefully.
 *
 * Coverage Goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { createValchecker, string, toSplitted } from '../..'

const v = createValchecker({ steps: [string, toSplitted] })

describe('toSplitted plugin', () => {
	describe('basic splitting', () => {
		it('should split string by comma', () => {
			const result = v.string()
				.toSplitted(',')
				.execute('a,b,c')
			expect(result).toEqual({ value: ['a', 'b', 'c'] })
		})

		it('should split string by space', () => {
			const result = v.string()
				.toSplitted(' ')
				.execute('hello world')
			expect(result).toEqual({ value: ['hello', 'world'] })
		})

		it('should handle string without separator', () => {
			const result = v.string()
				.toSplitted(',')
				.execute('hello')
			expect(result).toEqual({ value: ['hello'] })
		})

		it('should handle multiple consecutive separators', () => {
			const result = v.string()
				.toSplitted(',')
				.execute('a,,b')
			expect(result).toEqual({ value: ['a', '', 'b'] })
		})

		it('should handle separator at start', () => {
			const result = v.string()
				.toSplitted(',')
				.execute(',a,b')
			expect(result).toEqual({ value: ['', 'a', 'b'] })
		})

		it('should handle separator at end', () => {
			const result = v.string()
				.toSplitted(',')
				.execute('a,b,')
			expect(result).toEqual({ value: ['a', 'b', ''] })
		})

		it('should handle limit parameter', () => {
			const result = v.string()
				.toSplitted(',', 2)
				.execute('a,b,c,d')
			expect(result).toEqual({ value: ['a', 'b'] })
		})

		it('should handle regex separator', () => {
			const result = v.string()
				.toSplitted(/\s+/)
				.execute('hello   world')
			expect(result).toEqual({ value: ['hello', 'world'] })
		})
	})

	describe('edge cases', () => {
		it('should handle empty string', () => {
			const result = v.string()
				.toSplitted(',')
				.execute('')
			expect(result).toEqual({ value: [''] })
		})
	})
})
