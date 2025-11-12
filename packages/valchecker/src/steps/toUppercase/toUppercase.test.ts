/**
 * Test Plan for toUppercase.ts
 *
 * This test file covers the `toUppercase` step plugin implementation.
 *
 * Functions and Classes:
 * - toUppercase: A step plugin that transforms a string to uppercase.
 *
 * Input Scenarios:
 * - Valid inputs: Strings in lowercase, mixed case, already uppercase, with numbers/symbols, unicode.
 * - Edge cases: Empty strings.
 *
 * Expected Outputs and Behaviors:
 * - Success: Always returns { value: uppercaseString }.
 *
 * Error Handling and Exceptions:
 * - No exceptions; always succeeds as a transformation.
 *
 * Coverage Goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { createValchecker, string, toUppercase } from '../..'

const v = createValchecker({ steps: [string, toUppercase] })

describe('toUppercase plugin', () => {
	describe('valid inputs', () => {
		it('should convert lowercase to uppercase', () => {
			const result = v.string()
				.toUppercase()
				.execute('hello')
			expect(result).toEqual({ value: 'HELLO' })
		})

		it('should convert mixed case to uppercase', () => {
			const result = v.string()
				.toUppercase()
				.execute('HeLLo WoRlD')
			expect(result).toEqual({ value: 'HELLO WORLD' })
		})

		it('should leave uppercase unchanged', () => {
			const result = v.string()
				.toUppercase()
				.execute('HELLO')
			expect(result).toEqual({ value: 'HELLO' })
		})

		it('should handle strings with numbers and symbols', () => {
			const result = v.string()
				.toUppercase()
				.execute('Hello123!@#')
			expect(result).toEqual({ value: 'HELLO123!@#' })
		})

		it('should handle unicode characters', () => {
			const result = v.string()
				.toUppercase()
				.execute('hello 你好')
			expect(result).toEqual({ value: 'HELLO 你好' })
		})
	})

	describe('edge cases', () => {
		it('should handle empty string', () => {
			const result = v.string()
				.toUppercase()
				.execute('')
			expect(result).toEqual({ value: '' })
		})
	})
})
