import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue<T extends { length: number } = { length: number }> = ExecutionIssue<'isNotEmpty:expected_not_empty', { value: T, length: number }>
}

type Meta = DefineStepMethodMeta<{
	Name: 'isNotEmpty'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: { length: number } }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	isNotEmpty: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? InferOutput<this['CurrentValchecker']> extends infer CurrentOutput extends { length: number }
				? (message?: MessageHandler<Internal.Issue<CurrentOutput>>) => Next<
					{ issue: Internal.Issue<CurrentOutput> },
					this['CurrentValchecker']
				>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isNotEmpty = implStepPlugin<PluginDef>({
	isNotEmpty: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [message],
	}) => {
		addSuccessStep((value) => {
			const length = value.length
			return length > 0
				? success(value)
				: failure(createIssue({
					code: 'isNotEmpty:expected_not_empty',
					payload: { value, length },
					customMessage: message,
					defaultMessage: 'Expected a non-empty value.',
				}))
		})
	},
})
