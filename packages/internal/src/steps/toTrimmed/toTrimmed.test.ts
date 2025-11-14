/**
 * Test Plan for toTrimmed.ts
 *
 * This test file covers the `toTrimmed` step plugin implementation.
 *
 * Functions and Classes:
 * - toTrimmed: A step plugin that trims whitespace from both ends of a string.
 *
 * Input Scenarios:
 * - Valid inputs: Strings with leading/trailing whitespace, mixed, only whitespace, no whitespace, empty.
 * - Edge cases: Strings with tabs and newlines.
 *
 * Expected Outputs and Behaviors:
 * - Success: Always returns { value: trimmedString }.
 *
 * Error Handling and Exceptions:
 * - No exceptions; always succeeds as a transformation.
 *
 * Coverage Goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { createValchecker, string, toTrimmed } from '../..'

const v = createValchecker({ steps: [string, toTrimmed] })

describe('toTrimmed plugin', () => {
	describe('valid inputs', () => {
		it('should remove leading whitespace', () => {
			const result = v.string()
				.toTrimmed()
				.execute('  hello')
			expect(result).toEqual({ value: 'hello' })
		})

		it('should remove trailing whitespace', () => {
			const result = v.string()
				.toTrimmed()
				.execute('hello  ')
			expect(result).toEqual({ value: 'hello' })
		})

		it('should remove both leading and trailing whitespace', () => {
			const result = v.string()
				.toTrimmed()
				.execute('  hello world  ')
			expect(result).toEqual({ value: 'hello world' })
		})

		it('should handle strings with only whitespace', () => {
			const result = v.string()
				.toTrimmed()
				.execute('   ')
			expect(result).toEqual({ value: '' })
		})

		it('should leave strings without whitespace unchanged', () => {
			const result = v.string()
				.toTrimmed()
				.execute('hello')
			expect(result).toEqual({ value: 'hello' })
		})

		it('should handle empty string', () => {
			const result = v.string()
				.toTrimmed()
				.execute('')
			expect(result).toEqual({ value: '' })
		})
	})

	describe('edge cases', () => {
		it('should handle strings with tabs and newlines', () => {
			const result = v.string()
				.toTrimmed()
				.execute('\t\n hello \n\t')
			expect(result).toEqual({ value: 'hello' })
		})
	})
})
