import type { ExecutionIssue, InferIssue } from '../core'
import { describe, expectTypeOf, it } from 'vitest'
import {
	any,
	array,
	check,
	createValchecker,
	isLengthAtLeast,
	number,
	string,
	toFiltered,
	toJSONString,
	toMappedBoolean,
	toSorted,
} from '../..'

const v = createValchecker({
	steps: [
		any,
		array,
		check,
		isLengthAtLeast,
		number,
		string,
		toFiltered,
		toJSONString,
		toMappedBoolean,
		toSorted,
	],
})

type DomainIssue = ExecutionIssue<
	'domain:blocked',
	{ value: string, policy: 'reserved' }
>

describe('step failure payload type contracts', () => {
	it('preserves check result, callback failure, and added domain issue variants', () => {
		const schema = v.string()
			.check<DomainIssue>((value, { addIssue }) => {
				if (value === 'blocked') {
					addIssue({
						code: 'domain:blocked',
						category: 'validation',
						payload: { value, policy: 'reserved' },
						message: 'Blocked by policy.',
						path: [],
					})
				}
				if (value === 'existing') {
					addIssue({
						code: 'string:expected_string',
						category: 'validation',
						payload: { value },
						message: 'Existing issue.',
						path: [],
					})
				}
				return value === 'allowed' || 'Expected an allowed value.'
			}, { message: (issue) => {
				switch (issue.code) {
					case 'check:failed':
						if (issue.payload.reason === 'returned_message') {
							expectTypeOf(issue.payload.returnedMessage)
								.toEqualTypeOf<string>()
						}
						break
					case 'check:callback_failed':
						expectTypeOf(issue.payload.phase)
							.toEqualTypeOf<'throw' | 'reject'>()
						break
					case 'domain:blocked':
						expectTypeOf(issue.payload.policy)
							.toEqualTypeOf<'reserved'>()
						break
					case 'string:expected_string':
						expectTypeOf(issue.payload.value)
							.toEqualTypeOf<unknown>()
						break
				}
				return undefined
			} })

		expectTypeOf<InferIssue<typeof schema>>()
			.toMatchTypeOf<DomainIssue>()
	})

	it('keeps audited step message payloads precise', () => {
		v.array(v.string())
			.toFiltered(() => true, { message: (issue) => {
				expectTypeOf(issue.payload.item)
					.toEqualTypeOf<string>()
				expectTypeOf(issue.payload.index)
					.toEqualTypeOf<number>()
				expectTypeOf(issue.payload.error)
					.toEqualTypeOf<unknown>()
				return undefined
			} })
		v.array(v.string())
			.toSorted({ message: (issue) => {
				expectTypeOf(issue.payload.left)
					.toEqualTypeOf<string>()
				expectTypeOf(issue.payload.right)
					.toEqualTypeOf<string>()
				return undefined
			} })
		v.toJSONString({ message: (issue) => {
			if (issue.code === 'toJSONString:unserializable') {
				expectTypeOf(issue.payload.reason)
					.toEqualTypeOf<'unsupported_type' | 'circular_reference' | 'undefined_result'>()
				if (issue.payload.reason === 'unsupported_type') {
					expectTypeOf(issue.payload.valueType)
						.toEqualTypeOf<'bigint' | 'function' | 'symbol'>()
				}
			}
			else {
				expectTypeOf(issue.payload.error)
					.toEqualTypeOf<unknown>()
			}
			return undefined
		} })
		v.string()
			.isLengthAtLeast(2, { message: (issue) => {
				expectTypeOf(issue.payload.length)
					.toEqualTypeOf<number>()
				return undefined
			} })
		v.string()
			.toMappedBoolean({ trueValues: ['yes'], falseValues: ['no'], message: (issue) => {
				expectTypeOf(issue.payload.trueValues)
					.toEqualTypeOf<readonly string[]>()
				return undefined
			} })
	})
})
