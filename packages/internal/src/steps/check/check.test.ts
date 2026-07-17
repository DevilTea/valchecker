/**
 * Test Plan for check.ts
 *
 * Covers synchronous and asynchronous checks, issue collection, narrowing,
 * custom messages, thrown errors, rejected promises, and issue append order.
 */

import type { UnknownExceptionIssue } from '../../core'
import { describe, expect, it } from 'vitest'
import { check, createValchecker } from '../..'

const v = createValchecker({ steps: [check] })

function addTestIssue(
	value: unknown,
	addIssue: (issue: UnknownExceptionIssue<'check'>) => void,
): void {
	addIssue({
		code: 'core:unknown_exception',
		category: 'internal',
		payload: {
			method: 'check',
			receivedResult: { value },
			error: null,
		},
		message: 'Test issue',
		path: [],
	})
}

describe('check plugin', () => {
	describe('valid checks (sync pass)', () => {
		it('should pass when check returns true', () => {
			const result = v.check(value => value === 'pass')
				.execute('pass')
			expect(result)
				.toEqual({ value: 'pass' })
		})

		it('should collect issues from addIssue', () => {
			const result = v.check((value, utils) => {
				addTestIssue(value, utils.addIssue)
				return true
			})
				.execute('test')
			expect(result)
				.toEqual({
					issues: [{
						code: 'core:unknown_exception',
						category: 'internal',
						payload: {
							method: 'check',
							receivedResult: { value: 'test' },
							error: null,
						},
						message: 'Test issue',
						path: [],
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
			})
				.execute('narrow')
			expect(result)
				.toEqual({ value: 'narrow' })
		})
	})

	describe('invalid checks (sync fail)', () => {
		it('should fail when check returns false', () => {
			const result = v.check(value => value === 'pass')
				.execute('fail')
			expect(result)
				.toEqual({
					issues: [{
						code: 'check:failed',
						category: 'validation',
						message: 'Check failed',
						path: [],
						payload: { reason: 'returned_false', value: 'fail' },
					}],
				})
		})

		it('should fail with custom message when check returns string', () => {
			const result = v.check(value => value !== 'fail' ? true : 'Custom error')
				.execute('fail')
			expect(result)
				.toEqual({
					issues: [{
						code: 'check:failed',
						category: 'validation',
						message: 'Custom error',
						path: [],
						payload: { reason: 'returned_message', returnedMessage: 'Custom error', value: 'fail' },
					}],
				})
		})

		it('should append returned-false failure after added issues', () => {
			const result = v.check((value, utils) => {
				addTestIssue(value, utils.addIssue)
				return false
			}).execute('fail')
			expect(result).toMatchObject({
				issues: [
					{ code: 'core:unknown_exception' },
					{
						code: 'check:failed',
						payload: { reason: 'returned_false', value: 'fail' },
					},
				],
			})
		})

		it('should append returned-message failure after added issues', () => {
			const result = v.check((value, utils) => {
				addTestIssue(value, utils.addIssue)
				return 'Custom error'
			}).execute('fail')
			expect(result).toMatchObject({
				issues: [
					{ code: 'core:unknown_exception' },
					{
						code: 'check:failed',
						payload: {
							reason: 'returned_message',
							returnedMessage: 'Custom error',
							value: 'fail',
						},
					},
				],
			})
		})
	})

	describe('async checks', () => {
		it('should handle async check returning true', async () => {
			const result = await v.check(async value => value === 'async')
				.execute('async')
			expect(result)
				.toEqual({ value: 'async' })
		})

		it('should handle async check returning false', async () => {
			const result = await v.check(async value => value === 'async')
				.execute('sync')
			expect(result)
				.toEqual({
					issues: [{
						code: 'check:failed',
						category: 'validation',
						message: 'Check failed',
						path: [],
						payload: { reason: 'returned_false', value: 'sync' },
					}],
				})
		})
	})

	describe('error handling', () => {
		it('should handle thrown errors', () => {
			const result = v.check(() => {
				throw new Error('Thrown error')
			})
				.execute('error')
			expect(result)
				.toEqual({
					issues: [{
						code: 'check:callback_failed',
						category: 'operation',
						message: 'Check callback failed.',
						path: [],
						payload: { phase: 'throw', value: 'error', error: expect.any(Error) },
					}],
				})
		})

		it('should append callback failure after added issues', () => {
			const result = v.check((value, utils) => {
				addTestIssue(value, utils.addIssue)
				throw new Error('Thrown error')
			}).execute('error')
			expect(result).toMatchObject({
				issues: [
					{ code: 'core:unknown_exception' },
					{
						code: 'check:callback_failed',
						payload: { phase: 'throw', value: 'error', error: expect.any(Error) },
					},
				],
			})
		})

		it('should handle rejected checks', async () => {
			const result = await v.check(async () => {
				throw new Error('Rejected error')
			})
				.execute('error')
			expect(result)
				.toEqual({
					issues: [{
						code: 'check:callback_failed',
						category: 'operation',
						message: 'Check callback failed.',
						path: [],
						payload: { phase: 'reject', value: 'error', error: expect.any(Error) },
					}],
				})
		})
	})

	describe('custom message', () => {
		it('should use custom message handler', () => {
			const result = v.check(
				_value => false,
				issue => `Custom: ${issue.payload.value}`,
			)
				.execute('custom')
			expect(result)
				.toEqual({
					issues: [{
						code: 'check:failed',
						category: 'validation',
						message: 'Custom: custom',
						path: [],
						payload: { reason: 'returned_false', value: 'custom' },
					}],
				})
		})
	})
})
