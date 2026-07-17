import type { ExecutionIssue, InferIssue } from '../core'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
	any,
	array,
	check,
	createValchecker,
	isEmpty,
	isLengthAtLeast,
	isLengthAtMost,
	isNotEmpty,
	literal,
	string,
	toBigint,
	toFiltered,
	toJSONString,
	toMappedBoolean,
	toSorted,
	toString,
	transform,
} from '.'

const v = createValchecker({
	steps: [
		any,
		array,
		check,
		isEmpty,
		isLengthAtLeast,
		isLengthAtMost,
		isNotEmpty,
		literal,
		string,
		toBigint,
		toFiltered,
		toJSONString,
		toMappedBoolean,
		toSorted,
		toString,
		transform,
	],
})

type DomainIssue = ExecutionIssue<
	'domain:blocked',
	{ value: string, policy: 'reserved' }
>

describe('step failure and payload contracts', () => {
	it('types check result, callback failure, and added domain issues precisely', () => {
		const schema = v.string().check<DomainIssue>((value, { addIssue }) => {
			if (value === 'blocked') {
				addIssue({
					code: 'domain:blocked',
					category: 'validation',
					payload: { value, policy: 'reserved' },
					message: 'Blocked by policy.',
					path: [],
				})
			}
			return value === 'allowed' || 'Expected an allowed value.'
		}, (issue) => {
			switch (issue.code) {
				case 'check:failed':
					if (issue.payload.reason === 'returned_message')
						expectTypeOf(issue.payload.returnedMessage).toEqualTypeOf<string>()
					break
				case 'check:callback_failed':
					expectTypeOf(issue.payload.phase).toEqualTypeOf<'throw' | 'reject'>()
					break
				case 'domain:blocked':
					expectTypeOf(issue.payload.policy).toEqualTypeOf<'reserved'>()
					break
			}
			return undefined
		})

		expectTypeOf<InferIssue<typeof schema>>()
			.toMatchTypeOf<DomainIssue>()
	})

	it('reports check false and returned-message variants', () => {
		expect(v.check(() => false).execute('value')).toEqual({
			issues: [{
				code: 'check:failed',
				category: 'validation',
				message: 'Check failed.',
				path: [],
				payload: { reason: 'returned_false', value: 'value' },
			}],
		})

		expect(v.check(() => 'Returned message').execute('value')).toEqual({
			issues: [{
				code: 'check:failed',
				category: 'validation',
				message: 'Returned message',
				path: [],
				payload: {
					reason: 'returned_message',
					value: 'value',
					returnedMessage: 'Returned message',
				},
			}],
		})
	})

	it('preserves added check issues when the callback throws or rejects', async () => {
		const syncSchema = v.check<DomainIssue>((value, { addIssue }) => {
			addIssue({
				code: 'domain:blocked',
				category: 'validation',
				payload: { value: String(value), policy: 'reserved' },
				message: 'Domain issue.',
				path: [],
			})
			throw new Error('sync')
		})
		const syncResult = syncSchema.execute('value')
		expect(syncResult).toMatchObject({
			issues: [
				{ code: 'domain:blocked' },
				{
					code: 'check:callback_failed',
					category: 'operation',
					payload: { phase: 'throw', value: 'value', error: expect.any(Error) },
				},
			],
		})

		const asyncResult = await v.check<DomainIssue>(async (value, { addIssue }) => {
			addIssue({
				code: 'domain:blocked',
				category: 'validation',
				payload: { value: String(value), policy: 'reserved' },
				message: 'Domain issue.',
				path: [],
			})
			throw new Error('async')
		}).execute('value')
		expect(asyncResult).toMatchObject({
			issues: [
				{ code: 'domain:blocked' },
				{
					code: 'check:callback_failed',
					category: 'operation',
					payload: { phase: 'reject', value: 'value', error: expect.any(Error) },
				},
			],
		})
	})

	it('reports transform callback phases as operation issues', async () => {
		expect(v.transform(() => { throw new Error('sync') }).execute('value'))
			.toMatchObject({
				issues: [{
					code: 'transform:callback_failed',
					category: 'operation',
					payload: { phase: 'throw', value: 'value', error: expect.any(Error) },
				}],
			})

		expect(await v.transform(async () => { throw new Error('async') }).execute('value'))
			.toMatchObject({
				issues: [{
					code: 'transform:callback_failed',
					category: 'operation',
					payload: { phase: 'reject', value: 'value', error: expect.any(Error) },
				}],
			})
	})

	it('reports filter and sort callback operands', () => {
		expect(v.array(v.any()).toFiltered((item: number, index) => {
			if (index === 1)
				throw new Error('filter')
			return item > 0
		}).execute([1, 2, 3])).toMatchObject({
			issues: [{
				code: 'toFiltered:callback_failed',
				category: 'operation',
				payload: {
					value: [1, 2, 3],
					item: 2,
					index: 1,
					error: expect.any(Error),
				},
			}],
		})

		expect(v.array(v.any()).toSorted((left: number, right: number) => {
			throw new Error(`${left}:${right}`)
		}).execute([2, 1])).toMatchObject({
			issues: [{
				code: 'toSorted:callback_failed',
				category: 'operation',
				payload: {
					value: [2, 1],
					left: expect.any(Number),
					right: expect.any(Number),
					error: expect.any(Error),
				},
			}],
		})
	})

	it('reports toString conversion errors explicitly', () => {
		const value = { toString() { throw new Error('stringify') } }
		expect(v.any().toString().execute(value)).toMatchObject({
			issues: [{
				code: 'toString:conversion_failed',
				category: 'operation',
				payload: { value, error: expect.any(Error) },
			}],
		})
	})

	it('distinguishes JSON validation and operation failures', () => {
		const circular: Record<string, unknown> = {}
		circular.self = circular
		expect(v.toJSONString().execute(circular)).toMatchObject({
			issues: [{
				code: 'toJSONString:unserializable',
				category: 'validation',
				payload: { reason: 'circular_reference', value: circular, at: ['self'] },
			}],
		})

		expect(v.toJSONString().execute(1n)).toMatchObject({
			issues: [{
				code: 'toJSONString:unserializable',
				category: 'validation',
				payload: { reason: 'unsupported_type', value: 1n, at: [], valueType: 'bigint' },
			}],
		})

		const getterError = new Error('getter')
		const getterValue = Object.defineProperty({}, 'value', {
			enumerable: true,
			get() { throw getterError },
		})
		expect(v.toJSONString().execute(getterValue)).toMatchObject({
			issues: [{
				code: 'toJSONString:serialization_failed',
				category: 'operation',
				payload: { value: getterValue, at: ['value'], error: getterError },
			}],
		})

		expect(v.toJSONString().execute(Number.NaN)).toEqual({ value: 'null' })
		expect(v.toJSONString().execute(Number.POSITIVE_INFINITY)).toEqual({ value: 'null' })
	})

	it('snapshots actual length without requiring message handlers to re-read it', () => {
		const cases = [
			v.string().isLengthAtLeast(3).execute('x'),
			v.string().isLengthAtMost(1).execute('xx'),
			v.string().isEmpty().execute('x'),
			v.string().isNotEmpty().execute(''),
		]
		for (const result of cases)
			expect(result).toMatchObject({ issues: [{ payload: { length: expect.any(Number) } }] })
	})

	it('includes immutable mapping snapshots in mapped boolean failures', () => {
		const trueValues = ['yes'] as const
		const falseValues = ['no'] as const
		const result = v.toMappedBoolean({ trueValues, falseValues }).execute('maybe')
		expect(result).toMatchObject({
			issues: [{
				code: 'toMappedBoolean:unmapped_value',
				payload: { value: 'maybe', trueValues: ['yes'], falseValues: ['no'] },
			}],
		})
	})

	it('uses Object.is for literal equality', () => {
		expect(v.literal(Number.NaN).execute(Number.NaN)).toEqual({ value: Number.NaN })
		expect(v.literal(-0).execute(0)).toMatchObject({
			issues: [{ code: 'literal:expected_literal', payload: { value: 0, expected: -0 } }],
		})
	})

	it('uses the normalized bigint conversion code', () => {
		expect(v.any().toBigint().execute('not-bigint')).toMatchObject({
			issues: [{
				code: 'toBigint:conversion_failed',
				category: 'validation',
				payload: { value: 'not-bigint', error: expect.anything() },
			}],
		})
	})
})
