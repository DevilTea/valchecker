/**
 * Test Plan for empty.test.ts
 *
 * This file tests the empty step plugin implementation in empty.ts.
 *
 * Functions to test:
 * - empty: The step plugin that checks if the value has length 0.
 *
 * Test cases:
 * - Valid inputs: Empty strings and arrays.
 * - Invalid inputs: Non-empty strings and arrays, fails with 'empty:expected_empty'.
 * - Edge cases: Whitespace strings, arrays with null/undefined.
 * - Custom messages: Using custom message handler to override default message.
 * - Chaining: Chaining with string and array steps.
 *
 * Coverage goals: Achieve 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { array, createValchecker, empty, string } from '../..'

const v = createValchecker({ steps: [string, array, empty] })

describe('empty step plugin', () => {
	describe('valid inputs', () => {
		it('should pass for empty string', () => {
			const result = v.string()
				.empty()
				.execute('')
			expect(result)
				.toEqual({ value: '' })
		})

		it('should pass for empty array', () => {
			const result = v.array(v.string())
				.empty()
				.execute([])
			expect(result)
				.toEqual({ value: [] })
		})
	})

	describe('invalid inputs', () => {
		it('should fail for non-empty string', () => {
			const result = v.string()
				.empty()
				.execute('hello')
			expect(result)
				.toEqual({
					issues: [{
						code: 'empty:expected_empty',
						message: 'Expected an empty value.',
						path: [],
						payload: { value: 'hello' },
					}],
				})
		})

		it('should fail for non-empty array', () => {
			const result = v.array(v.string())
				.empty()
				.execute(['a'])
			expect(result)
				.toEqual({
					issues: [{
						code: 'empty:expected_empty',
						message: 'Expected an empty value.',
						path: [],
						payload: { value: ['a'] },
					}],
				})
		})
	})

	describe('edge cases', () => {
		it('should fail for whitespace string', () => {
			const result = v.string()
				.empty()
				.execute(' ')
			expect(result)
				.toEqual({
					issues: [{
						code: 'empty:expected_empty',
						message: 'Expected an empty value.',
						path: [],
						payload: { value: ' ' },
					}],
				})
		})

		it('should fail for array with elements', () => {
			const result = v.array(v.string())
				.empty()
				.execute([''])
			expect(result)
				.toEqual({
					issues: [{
						code: 'empty:expected_empty',
						message: 'Expected an empty value.',
						path: [],
						payload: { value: [''] },
					}],
				})
		})
	})

	describe('custom messages', () => {
		it('should use custom message for invalid input', () => {
			const result = v.string()
				.empty(issue => `Custom message for ${issue.payload.value}`)
				.execute('not empty')
			expect(result)
				.toEqual({
					issues: [{
						code: 'empty:expected_empty',
						message: 'Custom message for not empty',
						path: [],
						payload: { value: 'not empty' },
					}],
				})
		})
	})

	describe('chaining', () => {
		it('should chain with string step', () => {
			const result = v.string()
				.empty()
				.execute('')
			expect(result)
				.toEqual({ value: '' })
		})

		it('should chain with array step', () => {
			const result = v.array(v.string())
				.empty()
				.execute([])
			expect(result)
				.toEqual({ value: [] })
		})
	})
})
