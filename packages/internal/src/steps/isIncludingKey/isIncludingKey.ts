import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue<Input extends Map<any, any> = Map<any, any>> = ExecutionIssue<
		'isIncludingKey:expected_including_key',
		{ value: Input, expectedKey: Input extends Map<infer Key, any> ? Key : never }
	>
}

type Meta = DefineStepMethodMeta<{
	Name: 'isIncludingKey'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: Map<any, any> }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	isIncludingKey: DefineStepMethod<Meta, this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
		? InferOutput<This> extends infer Input extends Map<any, any>
			? (
					expectedKey: Input extends Map<infer Key, any> ? Key : never,
					options?: StepOptions<Internal.Issue<Input>>,
				) => Next<{ issue: Internal.Issue<Input> }, This>
			: never
		: never>
}

/* @__NO_SIDE_EFFECTS__ */
export const isIncludingKey = implStepPlugin<PluginDef>({
	isIncludingKey: ({ utils: { addSuccessStep, success, createIssue, failure }, params: [expectedKey, options] }) => {
		addSuccessStep(value => value.has(expectedKey)
			? success(value)
			: failure(createIssue({
					code: 'isIncludingKey:expected_including_key',
					payload: { value, expectedKey },
					customMessage: options?.message,
					defaultMessage: 'Expected the Map to include the configured key.',
				})))
	},
})
