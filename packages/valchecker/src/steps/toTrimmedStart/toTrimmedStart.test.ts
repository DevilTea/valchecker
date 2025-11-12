/**
 * Test Plan for toTrimmedStart.ts
 *
 * This test file covers the `toTrimmedStart` step plugin implementation.
 *
 * Functions and Classes:
 * - toTrimmedStart: A step plugin that trims whitespace from the start of a string.
 *
 * Input Scenarios:
 * - Valid inputs: Strings with leading whitespace, mixed whitespace, no leading whitespace, trailing only.
 * - Edge cases: Empty strings, strings with only whitespace.
 *
 * Expected Outputs and Behaviors:
 * - Success: Always returns { value: trimmedStartString }.
 *
 * Error Handling and Exceptions:
 * - No exceptions; always succeeds as a transformation.
 *
 * Coverage Goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { createValchecker, string, toTrimmedStart } from '../..'

const v = createValchecker({ steps: [string, toTrimmedStart] })

describe('toTrimmedStart plugin', () => {
	describe('valid inputs', () => {
		it('should remove leading spaces', () => {
			const result = v.string()
				.toTrimmedStart()
				.execute('   hello')
			expect(result).toEqual({ value: 'hello' })
		})

		it('should remove leading tabs', () => {
			const result = v.string()
				.toTrimmedStart()
				.execute('\t\thello')
			expect(result).toEqual({ value: 'hello' })
		})

		it('should remove leading newlines', () => {
			const result = v.string()
				.toTrimmedStart()
				.execute('\n\nhello')
			expect(result).toEqual({ value: 'hello' })
		})

		it('should remove mixed leading whitespace', () => {
			const result = v.string()
				.toTrimmedStart()
				.execute(' \t\n hello')
			expect(result).toEqual({ value: 'hello' })
		})

		it('should leave trailing whitespace', () => {
			const result = v.string()
				.toTrimmedStart()
				.execute('hello  ')
			expect(result).toEqual({ value: 'hello  ' })
		})

		it('should handle strings with both leading and trailing whitespace', () => {
			const result = v.string()
				.toTrimmedStart()
				.execute('  hello  ')
			expect(result).toEqual({ value: 'hello  ' })
		})

		it('should leave strings with no leading whitespace unchanged', () => {
			const result = v.string()
				.toTrimmedStart()
				.execute('hello')
			expect(result).toEqual({ value: 'hello' })
		})
	})

	describe('edge cases', () => {
		it('should handle empty string', () => {
			const result = v.string()
				.toTrimmedStart()
				.execute('')
			expect(result).toEqual({ value: '' })
		})

		it('should handle string with only whitespace', () => {
			const result = v.string()
				.toTrimmedStart()
				.execute('   \t\n  ')
			expect(result).toEqual({ value: '' })
		})
	})
})
