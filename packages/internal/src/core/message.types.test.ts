import type {
	DefineExpectedValchecker,
	DefineStepMethod,
	DefineStepMethodMeta,
	ExecutionIssue,
	MessageHandler,
	Next,
	StepMethodUtils,
	TStepPluginDef,
} from './types'
import { describe, expectTypeOf, it } from 'vitest'
import { bigint, isAtLeast, number, object, string } from '../steps'
import { createValchecker, implStepPlugin } from './core'

type CustomIssue = ExecutionIssue<'custom:failed', { value: number }>

type CustomMeta = DefineStepMethodMeta<{
	Name: 'custom'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: CustomIssue
}>

interface CustomPluginDef extends TStepPluginDef {
	custom: DefineStepMethod<
		CustomMeta,
		this['CurrentValchecker'] extends CustomMeta['ExpectedCurrentValchecker']
			? (message?: MessageHandler<CustomIssue>) => Next<
					{ issue: CustomIssue },
					this['CurrentValchecker']
				>
			: never
	>
}

const custom = implStepPlugin<CustomPluginDef>({
	custom: ({
		utils: { addSuccessStep, createIssue, failure },
		params: [message],
	}) => {
		addSuccessStep(value => failure(createIssue({
			code: 'custom:failed',
			payload: { value: Number(value) },
			customMessage: message,
			defaultMessage: 'Custom failure.',
		})))
	},
})

function assertCreateIssueContracts(
	utils: StepMethodUtils<number, number, CustomIssue, CustomIssue>,
): void {
	utils.createIssue({
		code: 'custom:failed',
		payload: { value: 1 },
	})

	// @ts-expect-error createIssue rejects an issue code not declared by SelfIssue.
	utils.createIssue({ code: 'custom:other', payload: { value: 1 } })

	// @ts-expect-error createIssue rejects a payload that does not match the selected code.
	utils.createIssue({ code: 'custom:failed', payload: { value: '1' } })

	// @ts-expect-error validation issues cannot be mislabeled as internal failures.
	utils.createIssue({ code: 'custom:failed', category: 'internal', payload: { value: 1 } })
}
void assertCreateIssueContracts

describe('message type contracts', () => {
	it('narrows selective global callbacks by issue code and payload variant', () => {
		createValchecker({
			steps: [bigint, isAtLeast, number, string],
			message: (issue) => {
				if (issue.code === 'string:expected_string') {
					expectTypeOf(issue.category).toEqualTypeOf<'validation'>()
					expectTypeOf(issue.payload.value).toEqualTypeOf<unknown>()
				}
				else if (issue.code === 'isAtLeast:expected_at_least') {
					if (issue.payload.target === 'number') {
						expectTypeOf(issue.payload.value).toEqualTypeOf<number>()
						expectTypeOf(issue.payload.minimum).toEqualTypeOf<number>()
					}
					else {
						expectTypeOf(issue.payload.value).toEqualTypeOf<bigint>()
						expectTypeOf(issue.payload.minimum).toEqualTypeOf<bigint>()
					}
				}
				else if (issue.code === 'core:message_exception') {
					expectTypeOf(issue.category).toEqualTypeOf<'internal'>()
					expectTypeOf(issue.payload.source).toEqualTypeOf<'step' | 'context' | 'global' | 'default'>()
				}
				return null
			},
		})
	})

	it('preserves message-map payload unions and nullable returns', () => {
		createValchecker({
			steps: [bigint, isAtLeast, number],
			message: {
				'isAtLeast:expected_at_least': ({ payload }) => {
					if (payload.target === 'number')
						expectTypeOf(payload.value).toEqualTypeOf<number>()
					else
						expectTypeOf(payload.value).toEqualTypeOf<bigint>()
					return undefined
				},
				'core:unknown_exception': () => null,
			},
		})
	})

	it('excludes unregistered issue codes from selective message maps', () => {
		createValchecker({
			steps: [string],
			message: {
				'string:expected_string': () => 'string',
				// @ts-expect-error number is not registered in this Valchecker instance.
				'number:expected_number': () => 'number',
			},
		})
	})

	it('keeps step, structure-child, and custom-plugin handlers precise', () => {
		const v = createValchecker({ steps: [custom, isAtLeast, number, object] })

		v.number().isAtLeast(10, ({ payload }) => {
			expectTypeOf(payload.target).toEqualTypeOf<'number'>()
			expectTypeOf(payload.minimum).toEqualTypeOf<number>()
			return null
		})

		v.object({ value: v.number() }, {
			'number:expected_number': ({ payload, path }) => {
				expectTypeOf(payload.value).toEqualTypeOf<unknown>()
				expectTypeOf(path).toEqualTypeOf<PropertyKey[]>()
				return undefined
			},
		})

		createValchecker({
			steps: [custom],
			message: {
				'custom:failed': ({ payload }) => {
					expectTypeOf(payload.value).toEqualTypeOf<number>()
					return String(payload.value)
				},
			},
		})
	})
})
