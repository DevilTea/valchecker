/**
 * Test Plan for startsWith.ts
 *
 * This test file covers the `startsWith` step plugin implementation.
 *
 * Functions and Classes:
 * - startsWith: A step plugin that validates if the input string starts with a specified prefix.
 *
 * Input Scenarios:
 * - Valid inputs: Strings that start with the prefix, including equal to prefix.
 * - Invalid inputs: Strings that do not start with the prefix, non-string types (though typically chained with string).
 * - Edge cases: Empty prefix, empty string, prefix longer than string, case sensitivity.
 * - Custom messages: Test with custom messages.
 * - Chaining: Test chaining with other steps like min.
 *
 * Expected Outputs and Behaviors:
 * - Success: When string starts with prefix, return { value: originalValue }.
 * - Failure: When string does not start with prefix, return { issues: [{ code: 'startsWith:expected_starts_with', payload: { value, prefix }, message }] }.
 *
 * Error Handling and Exceptions:
 * - No exceptions; all errors via issues.
 * - Custom messages override default.
 *
 * Coverage Goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { createValchecker, min, startsWith, string } from '../..'

const v = createValchecker({ steps: [string, startsWith, min] })

describe('startsWith plugin', () => {
	describe('valid inputs', () => {
		it('should pass when string starts with prefix', () => {
			const result = v.string()
				.startsWith('hello')
				.execute('hello world')
			expect(result)
				.toEqual({ value: 'hello world' })
		})

		it('should pass when string is equal to prefix', () => {
			const result = v.string()
				.startsWith('hello')
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should pass for empty prefix', () => {
			const result = v.string()
				.startsWith('')
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})
	})

	describe('invalid inputs', () => {
		it('should fail when string does not start with prefix', () => {
			const result = v.string()
				.startsWith('hello')
				.execute('world hello')
			expect(result)
				.toEqual({
					issues: [{
						code: 'startsWith:expected_starts_with',
						payload: { value: 'world hello', prefix: 'hello' },
						message: 'Expected the string to start with "hello".',
					}],
				})
		})

		it('should fail for empty string with non-empty prefix', () => {
			const result = v.string()
				.startsWith('a')
				.execute('')
			expect(result)
				.toEqual({
					issues: [{
						code: 'startsWith:expected_starts_with',
						payload: { value: '', prefix: 'a' },
						message: 'Expected the string to start with "a".',
					}],
				})
		})

		it('should fail when prefix is longer than string', () => {
			const result = v.string()
				.startsWith('longer')
				.execute('short')
			expect(result)
				.toEqual({
					issues: [{
						code: 'startsWith:expected_starts_with',
						payload: { value: 'short', prefix: 'longer' },
						message: 'Expected the string to start with "longer".',
					}],
				})
		})
	})

	describe('edge cases', () => {
		it('should be case-sensitive', () => {
			const result = v.string()
				.startsWith('Hello')
				.execute('hello world')
			expect(result)
				.toEqual({
					issues: [{
						code: 'startsWith:expected_starts_with',
						payload: { value: 'hello world', prefix: 'Hello' },
						message: 'Expected the string to start with "Hello".',
					}],
				})
		})

		it('should handle unicode strings', () => {
			const result = v.string()
				.startsWith('你好')
				.execute('你好世界')
			expect(result)
				.toEqual({ value: '你好世界' })
		})

		it('should fail for unicode mismatch', () => {
			const result = v.string()
				.startsWith('你好')
				.execute('世界你好')
			expect(result)
				.toEqual({
					issues: [{
						code: 'startsWith:expected_starts_with',
						payload: { value: '世界你好', prefix: '你好' },
						message: 'Expected the string to start with "你好".',
					}],
				})
		})
	})

	describe('custom messages', () => {
		it('should use custom message', () => {
			const result = v.string()
				.startsWith('hello', () => 'Custom message')
				.execute('world hello')
			expect(result)
				.toEqual({
					issues: [{
						code: 'startsWith:expected_starts_with',
						payload: { value: 'world hello', prefix: 'hello' },
						message: 'Custom message',
					}],
				})
		})
	})

	describe('chaining', () => {
		it('should chain with min length', () => {
			const result = v.string()
				.startsWith('he')
				.min(5)
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should fail chaining when startsWith fails', () => {
			const result = v.string()
				.startsWith('he')
				.min(5)
				.execute('hi')
			expect(result)
				.toEqual({
					issues: [{
						code: 'startsWith:expected_starts_with',
						payload: { value: 'hi', prefix: 'he' },
						message: 'Expected the string to start with "he".',
					}],
				})
		})

		it('should fail chaining when min fails', () => {
			const result = v.string()
				.startsWith('he')
				.min(5)
				.execute('he')
			expect(result)
				.toEqual({
					issues: [{
						code: 'min:expected_min',
						payload: { target: 'length', value: 'he', min: 5 },
						message: 'Expected a minimum length of 5.',
					}],
				})
		})
	})
})
