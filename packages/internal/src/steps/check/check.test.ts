import type { ExecutionIssue } from '../../core'
import { describe, expect, it } from 'vitest'
import { check, createValchecker } from '../..'

const v = createValchecker({ steps: [check] })

type DomainIssue = ExecutionIssue<'domain:blocked', { value: unknown }>

function addDomainIssue(value: unknown, addIssue: (issue: DomainIssue) => void): void {
	addIssue({
		code: 'domain:blocked',
		category: 'validation',
		payload: { value },
		message: 'Blocked by domain policy.',
		path: [],
	})
}

describe('check step plugin', () => {
	it('preserves the value when the predicate passes', () => {
		expect(v.check(value => value === 'pass')
			.execute('pass'))
			.toEqual({ value: 'pass' })
	})

	it('reports the complete returned-false failure contract', () => {
		expect(v.check(value => value === 'pass')
			.execute('fail'))
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

	it('uses a returned string as the failure message and payload reason', () => {
		expect(v.check(value => value !== 'fail' || 'Custom error')
			.execute('fail'))
			.toEqual({
				issues: [{
					code: 'check:failed',
					category: 'validation',
					message: 'Custom error',
					path: [],
					payload: {
						reason: 'returned_message',
						returnedMessage: 'Custom error',
						value: 'fail',
					},
				}],
			})
	})

	it('returns explicitly added issues even when the predicate otherwise passes', () => {
		expect(v.check<DomainIssue>((value, { addIssue }) => {
			addDomainIssue(value, addIssue)
			return true
		})
			.execute('blocked'))
			.toEqual({
				issues: [{
					code: 'domain:blocked',
					category: 'validation',
					payload: { value: 'blocked' },
					message: 'Blocked by domain policy.',
					path: [],
				}],
			})
	})

	it.each([
		['false', false, { reason: 'returned_false', value: 'fail' }],
		[
			'message',
			'Custom error',
			{ reason: 'returned_message', returnedMessage: 'Custom error', value: 'fail' },
		],
	] as const)('appends a returned-%s issue after explicitly added issues', (_case, returned, payload) => {
		const result = v.check<DomainIssue>((value, { addIssue }) => {
			addDomainIssue(value, addIssue)
			return returned
		})
			.execute('fail')

		expect(result)
			.toMatchObject({
				issues: [
					{ code: 'domain:blocked' },
					{ code: 'check:failed', payload },
				],
			})
	})

	it('supports asynchronous predicate success and failure', async () => {
		await expect(v.check(async value => value === 'pass')
			.execute('pass'))
			.resolves.toEqual({ value: 'pass' })
		await expect(v.check(async value => value === 'pass')
			.execute('fail'))
			.resolves.toMatchObject({
				issues: [{
					code: 'check:failed',
					payload: { reason: 'returned_false', value: 'fail' },
				}],
			})
	})

	it('reports a synchronous callback throw as an operation issue', () => {
		const error = new Error('Thrown error')
		expect(v.check(() => { throw error })
			.execute('value'))
			.toEqual({
				issues: [{
					code: 'check:callback_failed',
					category: 'operation',
					message: 'Check callback failed.',
					path: [],
					payload: { phase: 'throw', value: 'value', error },
				}],
			})
	})

	it('reports an asynchronous callback rejection as an operation issue', async () => {
		const error = new Error('Rejected error')
		await expect(v.check(async () => { throw error })
			.execute('value')).resolves.toEqual({
			issues: [{
				code: 'check:callback_failed',
				category: 'operation',
				message: 'Check callback failed.',
				path: [],
				payload: { phase: 'reject', value: 'value', error },
			}],
		})
	})

	it('uses a custom message handler for owned failures', () => {
		expect(v.check(() => false, { message: issue => `Custom: ${issue.payload.value}` },
		)
			.execute('value'))
			.toMatchObject({
				issues: [{
					code: 'check:failed',
					message: 'Custom: value',
				}],
			})
	})
})
