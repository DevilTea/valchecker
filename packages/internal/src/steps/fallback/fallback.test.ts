/**
 * Test Plan for fallback.ts
 *
 * Covers bypassed, synchronous, asynchronous, throwing, and rejecting fallback
 * paths, including received issues and custom messages.
 */

import { describe, expect, it } from 'vitest'
import { createValchecker, fallback, number, string } from '../..'

const v = createValchecker({ steps: [fallback, string, number] })

describe('fallback plugin', () => {
	describe('valid fallbacks (previous step succeeds)', () => {
		it('should not run fallback when previous step succeeds', () => {
			const result = v.string()
				.fallback(() => 'fallback')
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})
	})

	describe('fallback execution (previous step fails)', () => {
		it('should run fallback when previous step fails', () => {
			const result = v.number()
				.fallback(() => 42)
				.execute('not a number')
			expect(result)
				.toEqual({ value: 42 })
		})

		it('should pass issues array to fallback function', () => {
			let capturedIssues: any[] = []
			const result = v.number()
				.fallback((issues) => {
					capturedIssues = issues
					return 99
				})
				.execute('not a number')
			expect(result)
				.toEqual({ value: 99 })
			expect(capturedIssues)
				.toHaveLength(1)
			expect(capturedIssues[0])
				.toMatchObject({
					code: 'number:expected_number',
					payload: { value: 'not a number' },
				})
		})

		it('should handle async fallback function', async () => {
			const result = await v.number()
				.fallback(async () => {
					await new Promise(resolve => setTimeout(resolve, 1))
					return 100
				})
				.execute('not a number')
			expect(result)
				.toEqual({ value: 100 })
		})
	})

	describe('fallback failures', () => {
		it('should handle fallback function that throws error', () => {
			const result = v.number()
				.fallback(() => {
					throw new Error('Fallback error')
				})
				.execute('not a number')
			expect(result)
				.toEqual({
					issues: [{
						code: 'fallback:failed',
						message: 'Fallback failed',
						path: [],
						payload: {
							receivedIssues: [{
								code: 'number:expected_number',
								message: 'Expected a number.',
								path: [],
								payload: { value: 'not a number' },
							}],
							error: expect.any(Error),
						},
					}],
				})
		})

		it('should handle fallback function that rejects', async () => {
			const result = await v.number()
				.fallback(async () => {
					throw new Error('Rejected fallback error')
				})
				.execute('not a number')
			expect(result)
				.toEqual({
					issues: [{
						code: 'fallback:failed',
						message: 'Fallback failed',
						path: [],
						payload: {
							receivedIssues: [{
								code: 'number:expected_number',
								message: 'Expected a number.',
								path: [],
								payload: { value: 'not a number' },
							}],
							error: expect.any(Error),
						},
					}],
				})
		})

		it('should handle custom message', () => {
			const result = v.number()
				.fallback(() => {
					throw new Error('Custom fallback error')
				}, 'Custom fallback message')
				.execute('not a number')
			expect(result)
				.toEqual({
					issues: [{
						code: 'fallback:failed',
						message: 'Custom fallback message',
						path: [],
						payload: {
							receivedIssues: [{
								code: 'number:expected_number',
								message: 'Expected a number.',
								path: [],
								payload: { value: 'not a number' },
							}],
							error: expect.any(Error),
						},
					}],
				})
		})
	})
})