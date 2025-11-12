/**
 * Test Plan for array.ts
 *
 * This test file covers the `array` step plugin implementation.
 *
 * Functions and Classes:
 * - array: 		it('should handle async item validator with failure', async () => {
			const result = await v.array(v.string().transform(async (x) => {
				if (x === 'fail')
					throw new Error('fail')
				return x
			})).execute(['a', 'fail'])
			expect(result).toEqual({
				issues: [{
					code: 'transform:failed',
					path: [1],
					payload: { value: 'fail', error: expect.any(Error) },
				}],
			})
		})n definition and implementation.
 *
 * Input Scenarios:
 * - Non-array inputs: string, number, object, null, undefined.
 * - Valid arrays: empty, with valid items, with invalid items, mixed.
 * - Async item validators: success and failure.
 * - Edge cases: sparse arrays, null/undefined elements.
 *
 * Expected Outputs and Behaviors:
 * - Non-arrays: Issues with 'array:expected_array'.
 * - Valid arrays: Processed array or issues with prefixed paths.
 * - Async: Promise resolution with correct results.
 *
 * Error Handling and Exceptions:
 * - No exceptions; all errors handled via issues.
 *
 * Coverage Goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { array, createValchecker, number, string, transform } from '../..'

const v = createValchecker({ steps: [array, string, number, transform] })

describe('array plugin', () => {
	describe('invalid inputs (not arrays)', () => {
		it('should fail for string', () => {
			const result = v.array(v.string()).execute('not an array')
			expect(result).toEqual({
				issues: [{
					code: 'array:expected_array',
					payload: { value: 'not an array' },
					message: 'Expected an array.',
				}],
			})
		})

		it('should fail for number', () => {
			const result = v.array(v.string()).execute(42)
			expect(result).toEqual({
				issues: [{
					code: 'array:expected_array',
					payload: { value: 42 },
					message: 'Expected an array.',
				}],
			})
		})

		it('should fail for null', () => {
			const result = v.array(v.string()).execute(null)
			expect(result).toEqual({
				issues: [{
					code: 'array:expected_array',
					payload: { value: null },
					message: 'Expected an array.',
				}],
			})
		})

		it('should fail for undefined', () => {
			const result = v.array(v.string()).execute(undefined)
			expect(result).toEqual({
				issues: [{
					code: 'array:expected_array',
					payload: { value: undefined },
					message: 'Expected an array.',
				}],
			})
		})

		it('should fail for object', () => {
			const result = v.array(v.string()).execute({})
			expect(result).toEqual({
				issues: [{
					code: 'array:expected_array',
					payload: { value: {} },
					message: 'Expected an array.',
				}],
			})
		})
	})

	describe('valid arrays', () => {
		it('should pass for empty array with string item validator', () => {
			const result = v.array(v.string()).execute([])
			expect(result).toEqual({ value: [] })
		})

		it('should pass for array of strings', () => {
			const result = v.array(v.string()).execute(['a', 'b', 'c'])
			expect(result).toEqual({ value: ['a', 'b', 'c'] })
		})

		it('should pass for array of numbers', () => {
			const result = v.array(v.number()).execute([1, 2, 3])
			expect(result).toEqual({ value: [1, 2, 3] })
		})

		it('should fail for array with invalid items', () => {
			const result = v.array(v.string()).execute(['a', 1, 'c'])
			expect(result).toEqual({
				issues: [{
					code: 'string:expected_string',
					path: [1],
					payload: { value: 1 },
					message: 'Expected a string.',
				}],
			})
		})

		it('should collect multiple issues', () => {
			const result = v.array(v.string()).execute(['a', 1, 2])
			expect(result).toEqual({
				issues: [
					{
						code: 'string:expected_string',
						path: [1],
						payload: { value: 1 },
						message: 'Expected a string.',
					},
					{
						code: 'string:expected_string',
						path: [2],
						payload: { value: 2 },
						message: 'Expected a string.',
					},
				],
			})
		})

		it('should handle async item validator', async () => {
			const result = await v.array(v.string().transform(async x => x)).execute(['a', 'b'])
			expect(result).toEqual({ value: ['a', 'b'] })
		})

		it('should handle async item validator with failure', async () => {
			const result = await v.array(v.string().transform(async (x) => {
				if (x === 'fail')
					throw new Error('fail')
				return x
			})).execute(['a', 'fail'])
			expect(result).toEqual({
				issues: [{
					code: 'transform:failed',
					path: [1],
					payload: { value: 'fail', error: expect.any(Error) },
					message: 'Transform failed',
				}],
			})
		})
	})

	describe('edge cases', () => {
		it('should handle array with null and undefined', () => {
			const result = v.array(v.string()).execute(['a', null, undefined])
			expect(result).toEqual({
				issues: [
					{
						code: 'string:expected_string',
						path: [1],
						payload: { value: null },
						message: 'Expected a string.',
					},
					{
						code: 'string:expected_string',
						path: [2],
						payload: { value: undefined },
						message: 'Expected a string.',
					},
				],
			})
		})

		it('should handle sparse array', () => {
			const arr = ['a']
			arr[2] = 'c'
			const result = v.array(v.string()).execute(arr)
			expect(result).toEqual({
				issues: [{
					code: 'string:expected_string',
					path: [1],
					payload: { value: undefined },
					message: 'Expected a string.',
				}],
			})
		})
	})

	describe('custom messages', () => {
		it('should use custom message for invalid array input', () => {
			const result = v.array(v.string(), () => 'Custom array message').execute('not an array')
			expect(result).toEqual({
				issues: [{
					code: 'array:expected_array',
					payload: { value: 'not an array' },
					message: 'Custom array message',
				}],
			})
		})
	})
})
