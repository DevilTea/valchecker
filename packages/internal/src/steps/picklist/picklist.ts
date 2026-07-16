import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Literal = bigint | boolean | number | string | symbol | null | undefined
	export type Values = readonly [Literal, ...Literal[]]
	export type Issue<V extends Values = Values> = ExecutionIssue<'picklist:expected_value', { value: unknown, expected: V }>
}

type Meta = DefineStepMethodMeta<{
	Name: 'picklist'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * Checks that the value equals one of the provided literal values.
	 *
	 * @example `v.picklist(['draft', 'published'])`
	 * @issue `picklist:expected_value`
	 */
	picklist: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				? <const V extends Internal.Values>(values: V, message?: MessageHandler<Internal.Issue<V>>) => Next<{
					output: V[number]
					issue: Internal.Issue<V>
				}, this['CurrentValchecker']>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const picklist = implStepPlugin<PluginDef>({
	picklist: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [values, message],
	}) => {
		addSuccessStep((value) => {
			for (let i = 0; i < values.length; i++) {
				if (value === values[i])
					return success(value as typeof values[number])
			}
			return failure(createIssue({
				code: 'picklist:expected_value',
				payload: { value, expected: values },
				customMessage: message,
				defaultMessage: 'Expected one of the allowed literal values.',
			}))
		})
	},
})
