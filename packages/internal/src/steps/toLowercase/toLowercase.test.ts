/**
 * Test Plan for toLowercase.ts
 *
 * This test file covers the `toLowercase` step plugin implementation.
 *
 * Functions and Classes:
 * - toLowercase: A step plugin that transforms a string to lowercase.
 *
 * Input Scenarios:
 * - Valid inputs: Strings in uppercase, mixed case, already lowercase, with numbers/symbols, unicode.
 * - Edge cases: Empty strings.
 *
 * Expected Outputs and Behaviors:
 * - Success: Always returns { value: lowercaseString }.
 *
 * Error Handling and Exceptions:
 * - No exceptions; always succeeds as a transformation.
 *
 * Coverage Goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { createValchecker, string, toLowercase } from '../..'

const v = createValchecker({ steps: [string, toLowercase] })

describe('toLowercase plugin', () => {
	describe('valid inputs', () => {
		it('should convert uppercase to lowercase', () => {
			const result = v.string()
				.toLowercase()
				.execute('HELLO')
			expect(result).toEqual({ value: 'hello' })
		})

		it('should convert mixed case to lowercase', () => {
			const result = v.string()
				.toLowercase()
				.execute('HeLLo WoRlD')
			expect(result).toEqual({ value: 'hello world' })
		})

		it('should leave lowercase unchanged', () => {
			const result = v.string()
				.toLowercase()
				.execute('hello')
			expect(result).toEqual({ value: 'hello' })
		})

		it('should handle strings with numbers and symbols', () => {
			const result = v.string()
				.toLowercase()
				.execute('Hello123!@#')
			expect(result).toEqual({ value: 'hello123!@#' })
		})

		it('should handle unicode characters', () => {
			const result = v.string()
				.toLowercase()
				.execute('HELLO 你好')
			expect(result).toEqual({ value: 'hello 你好' })
		})
	})

	describe('edge cases', () => {
		it('should handle empty string', () => {
			const result = v.string()
				.toLowercase()
				.execute('')
			expect(result).toEqual({ value: '' })
		})
	})
})
