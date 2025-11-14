/**
 * Test Plan for endsWith.test.ts
 *
 * This file tests the endsWith step plugin implementation in endsWith.ts.
 *
 * Functions to test:
 * - endsWith: The step plugin that checks if the string ends with a specified suffix.
 *
 * Test cases:
 * - Valid inputs: Strings that end with the suffix.
 * - Invalid inputs: Strings that do not end with the suffix, fails with 'endsWith:expected_ends_with'.
 * - Edge cases: Empty strings, empty suffixes, case sensitivity.
 * - Custom messages: Using custom message handler to override default message.
 * - Chaining: Chaining with string step.
 *
 * Coverage goals: Achieve 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { createValchecker, endsWith, string } from '../..'

const v = createValchecker({ steps: [string, endsWith] })

describe('endsWith step plugin', () => {
	describe('valid inputs', () => {
		it('should pass when string ends with suffix', () => {
			const result = v.string()
				.endsWith('world')
				.execute('hello world')
			expect(result).toEqual({ value: 'hello world' })
		})

		it('should pass when string is equal to suffix', () => {
			const result = v.string()
				.endsWith('hello')
				.execute('hello')
			expect(result).toEqual({ value: 'hello' })
		})

		it('should pass for empty suffix', () => {
			const result = v.string()
				.endsWith('')
				.execute('hello')
			expect(result).toEqual({ value: 'hello' })
		})
	})

	describe('invalid inputs', () => {
		it('should fail when string does not end with suffix', () => {
			const result = v.string()
				.endsWith('world')
				.execute('hello there')
			expect(result).toEqual({
				issues: [{
					code: 'endsWith:expected_ends_with',
					payload: { value: 'hello there', suffix: 'world' },
					message: 'Expected the string to end with "world".',
				}],
			})
		})

		it('should fail for empty string with non-empty suffix', () => {
			const result = v.string()
				.endsWith('a')
				.execute('')
			expect(result).toEqual({
				issues: [{
					code: 'endsWith:expected_ends_with',
					payload: { value: '', suffix: 'a' },
					message: 'Expected the string to end with "a".',
				}],
			})
		})

		it('should fail when suffix is longer than string', () => {
			const result = v.string()
				.endsWith('longer')
				.execute('short')
			expect(result).toEqual({
				issues: [{
					code: 'endsWith:expected_ends_with',
					payload: { value: 'short', suffix: 'longer' },
					message: 'Expected the string to end with "longer".',
				}],
			})
		})

		it('should fail when case does not match', () => {
			const result = v.string()
				.endsWith('World')
				.execute('hello world')
			expect(result).toEqual({
				issues: [{
					code: 'endsWith:expected_ends_with',
					payload: { value: 'hello world', suffix: 'World' },
					message: 'Expected the string to end with "World".',
				}],
			})
		})
	})

	describe('edge cases', () => {
		it('should handle unicode strings', () => {
			const result = v.string()
				.endsWith('世界')
				.execute('你好世界')
			expect(result).toEqual({ value: '你好世界' })
		})

		it('should fail for unicode mismatch', () => {
			const result = v.string()
				.endsWith('世界')
				.execute('你好地球')
			expect(result).toEqual({
				issues: [{
					code: 'endsWith:expected_ends_with',
					payload: { value: '你好地球', suffix: '世界' },
					message: 'Expected the string to end with "世界".',
				}],
			})
		})
	})

	describe('custom messages', () => {
		it('should use custom message for invalid input', () => {
			const result = v.string()
				.endsWith('world', () => 'Custom message')
				.execute('hello there')
			expect(result).toEqual({
				issues: [{
					code: 'endsWith:expected_ends_with',
					payload: { value: 'hello there', suffix: 'world' },
					message: 'Custom message',
				}],
			})
		})
	})

	describe('chaining', () => {
		it('should chain with string step', () => {
			const result = v.string()
				.endsWith('world')
				.execute('hello world')
			expect(result).toEqual({ value: 'hello world' })
		})
	})
})
