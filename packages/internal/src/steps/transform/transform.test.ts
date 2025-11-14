/**
 * Test plan for transform step:
 * - Functions tested: transform validation with optional custom messages.
 * - Valid inputs: synchronous and asynchronous successful transformations.
 * - Invalid inputs: synchronous and asynchronous failed transformations.
 * - Edge cases: custom message handler.
 * - Expected behaviors: Success returns { value: transformedValue }; failure returns { issues: [{ code: 'transform:failed', payload: { value, error }, message }] }.
 * - Error handling: Catches sync errors and promise rejections.
 * - Coverage goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { createValchecker, string, transform } from '../..'

const v = createValchecker({ steps: [string, transform] })

describe('transform plugin', () => {
	describe('valid inputs', () => {
		it('should succeed with sync transform', () => {
			const result = v.string()
				.transform(x => x.toUpperCase())
				.execute('hello')
			expect(result).toEqual({ value: 'HELLO' })
		})
	})

	describe('invalid inputs', () => {
		it('should fail with sync transform error', () => {
			const result = v.string()
				.transform((_x) => {
					throw new Error('sync error')
				})
				.execute('hello')
			expect(result).toEqual({
				issues: [{
					code: 'transform:failed',
					payload: { value: 'hello', error: expect.any(Error) },
					message: 'Transform failed',
				}],
			})
		})
	})

	describe('edge cases', () => {
		it('should succeed with async transform', async () => {
			const result = await v.string()
				.transform(async x => x.toUpperCase())
				.execute('hello')
			expect(result).toEqual({ value: 'HELLO' })
		})

		it('should fail with async transform error', async () => {
			const result = await v.string()
				.transform(async (_x) => {
					throw new Error('async error')
				})
				.execute('hello')
			expect(result).toEqual({
				issues: [{
					code: 'transform:failed',
					payload: { value: 'hello', error: expect.any(Error) },
					message: 'Transform failed',
				}],
			})
		})

		it('should use custom message handler', () => {
			const result = v.string()
				.transform(
					(_x: string) => { throw new Error('error') },
					issue => `Custom: ${(issue.payload.error as any).message}`,
				)
				.execute('hello')
			expect(result).toEqual({
				issues: [{
					code: 'transform:failed',
					payload: { value: 'hello', error: expect.any(Error) },
					message: 'Custom: error',
				}],
			})
		})
	})
})
