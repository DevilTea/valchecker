import type { ExecutionIssue } from '../core'
import { describe, expect, it } from 'vitest'
import {
	any,
	array,
	check,
	createValchecker,
	toFiltered,
	toSorted,
	transform,
} from '../..'

const v = createValchecker({
	steps: [any, array, check, toFiltered, toSorted, transform],
})

type DomainIssue = ExecutionIssue<'domain:blocked', { value: string }>

describe('callback operation family contracts', () => {
	it('classifies synchronous throws and asynchronous rejections as operation failures', async () => {
		const syncError = new Error('sync')
		const asyncError = new Error('async')

		expect(v.transform(() => { throw syncError })
			.execute('value'))
			.toMatchObject({
				issues: [{
					code: 'transform:callback_failed',
					category: 'operation',
					payload: { phase: 'throw', value: 'value', error: syncError },
				}],
			})
		await expect(v.transform(async () => { throw asyncError })
			.execute('value')).resolves.toMatchObject({
			issues: [{
				code: 'transform:callback_failed',
				category: 'operation',
				payload: { phase: 'reject', value: 'value', error: asyncError },
			}],
		})
		expect(v.check(() => { throw syncError })
			.execute('value'))
			.toMatchObject({
				issues: [{
					code: 'check:callback_failed',
					category: 'operation',
					payload: { phase: 'throw', value: 'value', error: syncError },
				}],
			})
		await expect(v.check(async () => { throw asyncError })
			.execute('value')).resolves.toMatchObject({
			issues: [{
				code: 'check:callback_failed',
				category: 'operation',
				payload: { phase: 'reject', value: 'value', error: asyncError },
			}],
		})
	})

	it('retains callback operands in filter and sort operation issues', () => {
		const filterError = new Error('filter')
		expect(v.array(v.any())
			.toFiltered((item: number, index) => {
				if (index === 1)
					throw filterError
				return item > 0
			})
			.execute([1, 2, 3]))
			.toMatchObject({
				issues: [{
					code: 'toFiltered:callback_failed',
					category: 'operation',
					payload: {
						value: [1, 2, 3],
						item: 2,
						index: 1,
						error: filterError,
					},
				}],
			})

		const sortError = new Error('sort')
		expect(v.array(v.any())
			.toSorted({ compareFn: (left: number, right: number) => {
				throw sortError
			} })
			.execute([2, 1]))
			.toMatchObject({
				issues: [{
					code: 'toSorted:callback_failed',
					category: 'operation',
					payload: {
						value: [2, 1],
						left: expect.any(Number),
						right: expect.any(Number),
						error: sortError,
					},
				}],
			})
	})

	it('keeps explicitly added check issues before a callback failure', async () => {
		const schema = v.check<DomainIssue>(async (value, { addIssue }) => {
			addIssue({
				code: 'domain:blocked',
				category: 'validation',
				payload: { value: String(value) },
				message: 'Domain issue.',
				path: [],
			})
			throw new Error('callback')
		})

		await expect(schema.execute('value')).resolves.toMatchObject({
			issues: [
				{ code: 'domain:blocked', payload: { value: 'value' } },
				{
					code: 'check:callback_failed',
					category: 'operation',
					payload: { phase: 'reject', value: 'value' },
				},
			],
		})
	})
})
