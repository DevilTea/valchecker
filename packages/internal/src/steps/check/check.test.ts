/**
 * Test Plan for check.ts
 *
 * This test file covers the `check` step plugin implementation.
 *
 * Functions and Classes:
 * - check: The step plugin that runs a custom check function.
 *
 * Input Scenarios:
 * - Synchronous check returning true: pass.
 * - Synchronous check returning false: fail with default message.
 * - Synchronous check returning string: fail with string as message.
 * - Synchronous check using addIssue: collect issues.
 * - Synchronous check using narrow: narrow type.
 * - Asynchronous check: handle promises.
 * - Check throwing error: handle exceptions.
 * - Custom message handler: custom error message.
 *
 * Expected Outputs and Behaviors:
 * - Success: Returns the value.
 * - Failure: Issues with 'check:failed' code.
 * - Async: Promise resolution.
 *
 * Error Handling and Exceptions:
 * - Catches exceptions and returns issues.
 *
 * Coverage Goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { check, createValchecker } from '../..'

const v = createValchecker({ steps: [check] })

describe('check plugin', () => {
	describe('valid checks (sync pass)', () => {
		it('should pass when check returns true', () => {
			const result = v.check(value => value === 'pass').execute('pass')
			expect(result).toEqual({ value: 'pass' })
		})

		it('should collect issues from addIssue', () => {
			const result = v.check((value, utils) => {
				utils.addIssue({
					code: 'core:unknown_exception',
					payload: {
						method: 'check',
						value,
						error: null,
					},
					message: 'Test issue',
				})
				return true
			}).execute('test')
			expect(result).toEqual({
				issues: [{
					code: 'core:unknown_exception',
					payload: {
						method: 'check',
						value: 'test',
						error: null,
					},
					message: 'Test issue',
				}],
			})
		})

		it('should handle narrow function', () => {
			const result = v.check((value, utils) => {
				if (typeof value === 'string') {
					utils.narrow<'string'>()
					return true
				}
				return false
			}).execute('narrow')
			expect(result).toEqual({ value: 'narrow' })
		})
	})

	describe('invalid checks (sync fail)', () => {
		it('should fail when check returns false', () => {
			const result = v.check(value => value === 'pass').execute('fail')
			expect(result).toEqual({
				issues: [{
					code: 'check:failed',
					payload: { value: 'fail' },
					message: 'Check failed',
				}],
			})
		})

		it('should fail with custom message when check returns string', () => {
			const result = v.check(value => value !== 'fail' ? true : 'Custom error').execute('fail')
			expect(result).toEqual({
				issues: [{
					code: 'check:failed',
					payload: { value: 'fail' },
					message: 'Custom error',
				}],
			})
		})
	})

	describe('async checks', () => {
		it('should handle async check returning true', async () => {
			const result = await v.check(async value => value === 'async').execute('async')
			expect(result).toEqual({ value: 'async' })
		})

		it('should handle async check returning false', async () => {
			const result = await v.check(async value => value === 'async').execute('sync')
			expect(result).toEqual({
				issues: [{
					code: 'check:failed',
					payload: { value: 'sync' },
					message: 'Check failed',
				}],
			})
		})
	})

	describe('error handling', () => {
		it('should handle thrown errors', () => {
			const result = v.check(() => {
				throw new Error('Thrown error')
			}).execute('error')
			expect(result).toEqual({
				issues: [{
					code: 'check:failed',
					payload: { value: 'error', error: expect.any(Error) },
					message: 'Check failed',
				}],
			})
		})
	})

	describe('custom message', () => {
		it('should use custom message handler', () => {
			const result = v.check(
				_value => false,
				issue => `Custom: ${issue.payload.value}`,
			).execute('custom')
			expect(result).toEqual({
				issues: [{
					code: 'check:failed',
					payload: { value: 'custom' },
					message: 'Custom: custom',
				}],
			})
		})
	})
})
