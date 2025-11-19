/**
 * Test Plan for toTrimmedEnd.ts
 *
 * This test file covers the `toTrimmedEnd` step plugin implementation.
 *
 * Functions and Classes:
 * - toTrimmedEnd: A step plugin that trims whitespace from the end of a string.
 *
 * Input Scenarios:
 * - Valid inputs: Strings with trailing whitespace, mixed whitespace, no trailing whitespace, leading only.
 * - Edge cases: Empty strings, strings with only whitespace.
 *
 * Expected Outputs and Behaviors:
 * - Success: Always returns { value: trimmedEndString }.
 *
 * Error Handling and Exceptions:
 * - No exceptions; always succeeds as a transformation.
 *
 * Coverage Goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { createValchecker, string, toTrimmedEnd } from '../..'

const v = createValchecker({ steps: [string, toTrimmedEnd] })

describe('toTrimmedEnd plugin', () => {
	describe('valid inputs', () => {
		it('should remove trailing spaces', () => {
			const result = v.string()
				.toTrimmedEnd()
				.execute('hello   ')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should remove trailing tabs', () => {
			const result = v.string()
				.toTrimmedEnd()
				.execute('hello\t\t')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should remove trailing newlines', () => {
			const result = v.string()
				.toTrimmedEnd()
				.execute('hello\n\n')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should remove mixed trailing whitespace', () => {
			const result = v.string()
				.toTrimmedEnd()
				.execute('hello \t\n ')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should leave leading whitespace', () => {
			const result = v.string()
				.toTrimmedEnd()
				.execute('  hello')
			expect(result)
				.toEqual({ value: '  hello' })
		})

		it('should handle strings with both leading and trailing whitespace', () => {
			const result = v.string()
				.toTrimmedEnd()
				.execute('  hello  ')
			expect(result)
				.toEqual({ value: '  hello' })
		})

		it('should leave strings with no trailing whitespace unchanged', () => {
			const result = v.string()
				.toTrimmedEnd()
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})
	})

	describe('edge cases', () => {
		it('should handle empty string', () => {
			const result = v.string()
				.toTrimmedEnd()
				.execute('')
			expect(result)
				.toEqual({ value: '' })
		})

		it('should handle string with only whitespace', () => {
			const result = v.string()
				.toTrimmedEnd()
				.execute('   \t\n  ')
			expect(result)
				.toEqual({ value: '' })
		})
	})
})
