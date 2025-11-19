/**
 * Test Plan for fallback.ts
 *
 * This test file covers the `fallback` step plugin implementation.
 *
 * Functions and Classes:
 * - fallback: The step plugin that provides a fallback value when previous validation fails.
 *
 * Input Scenarios:
 * - Previous step succeeds: should not run fallback.
 * - Previous step fails: should run fallback function.
 * - Fallback function throws error: should return fallback:failed issue.
 * - Async fallback function: should handle promises.
 * - Custom message: should use custom message for fallback failure.
 * - Issues passed to fallback: should receive issues array.
 *
 * Expected Outputs and Behaviors:
 * - Success: Returns the original value if no fallback needed.
 * - Fallback success: Returns the fallback value.
 * - Fallback failure: Issues with code 'fallback:failed'.
 * - Async: Promise resolution.
 *
 * Error Handling and Exceptions:
 * - No exceptions; fallback errors handled via issues.
 *
 * Coverage Goals: 100% statement, branch, and function coverage.
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
						payload: {
							receivedIssues: [{
								code: 'number:expected_number',
								payload: { value: 'not a number' },
								message: 'Expected a number (NaN is not allowed).',
							}],
							error: expect.any(Error),
						},
						message: 'Fallback failed',
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
						payload: {
							receivedIssues: [{
								code: 'number:expected_number',
								payload: { value: 'not a number' },
								message: 'Expected a number (NaN is not allowed).',
							}],
							error: expect.any(Error),
						},
						message: 'Custom fallback message',
					}],
				})
		})
	})
})
