/**
 * Test plan for toAsync step:
 * - Functions tested: toAsync validation that forces maybe-async operation to be async.
 * - Valid inputs: maybe-async operations (sync and async).
 * - Invalid inputs: N/A (toAsync doesn't fail).
 * - Edge cases: sync values, async values, success results, failure results.
 * - Expected behaviors: Success returns Promise.resolve({ value }); failure returns Promise.resolve({ issues }).
 * - Error handling: No errors expected as Promise.resolve handles all inputs.
 * - Coverage goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { createValchecker, string, toAsync, transform } from '../..'

const v = createValchecker({ steps: [string, transform, toAsync] })

describe('toAsync plugin', () => {
	describe('valid inputs', () => {
		it('should convert sync success result to async', async () => {
			const result = await v.string()
				.transform((x: string) => x.toUpperCase())
				.toAsync()
				.execute('hello')
			expect(result)
				.toEqual({ value: 'HELLO' })
		})

		it('should handle already async result', async () => {
			const result = await v.string()
				.transform(async (x: string) => x.toUpperCase())
				.toAsync()
				.execute('hello')
			expect(result)
				.toEqual({ value: 'HELLO' })
		})

		it('should handle failure results', async () => {
			const result = await v.string()
				.toAsync()
				.execute(123)
			expect(result)
				.toEqual({
					issues: [{
						code: 'string:expected_string',
						payload: { value: 123 },
						message: 'Expected a string.',
						path: [],
					}],
				})
		})
	})

	describe('edge cases', () => {
		it('should handle empty string', async () => {
			const result = await v.string()
				.toAsync()
				.execute('')
			expect(result)
				.toEqual({ value: '' })
		})

		it('should work with multiple transformations', async () => {
			const result = await v.string()
				.transform((x: string) => x.toLowerCase())
				.transform((x: string) => x.trim())
				.toAsync()
				.execute('  HELLO  ')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should handle async errors in transform', async () => {
			const result = await v.string()
				.transform(async () => {
					throw new Error('async error')
				})
				.toAsync()
				.execute('test')
			expect(result)
				.toEqual({
					issues: [{
						code: 'transform:failed',
						payload: { value: 'test', error: expect.any(Error) },
						message: 'Transform failed',
						path: [],
					}],
				})
		})
	})
})
