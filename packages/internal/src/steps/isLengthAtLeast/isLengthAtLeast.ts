import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace LengthAtLeastInternal {
	export type Issue<T extends { length: number } = { length: number }> = ExecutionIssue<
		'isLengthAtLeast:expected_length_at_least',
		{ value: T, minimum: number, length: number }
	>
}

type LengthAtLeastMeta = DefineStepMethodMeta<{
	Name: 'isLengthAtLeast'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: { length: number } }>
	SelfIssue: LengthAtLeastInternal.Issue
}>

interface LengthAtLeastPluginDef extends TStepPluginDef {
	isLengthAtLeast: DefineStepMethod<
		LengthAtLeastMeta,
		this['CurrentValchecker'] extends LengthAtLeastMeta['ExpectedCurrentValchecker']
			? InferOutput<this['CurrentValchecker']> extends infer CurrentOutput extends { length: number }
				? (minimum: number, message?: MessageHandler<LengthAtLeastInternal.Issue<CurrentOutput>>) => Next<
					{ issue: LengthAtLeastInternal.Issue<CurrentOutput> },
					this['CurrentValchecker']
				>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isLengthAtLeast = implStepPlugin<LengthAtLeastPluginDef>({
	isLengthAtLeast: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [minimum, message],
	}) => {
		addSuccessStep((value) => {
			const length = value.length
			return length >= minimum
				? success(value)
				: failure(createIssue({
					code: 'isLengthAtLeast:expected_length_at_least',
					payload: { value, minimum, length },
					customMessage: message,
					defaultMessage: `Expected a length of at least ${minimum}.`,
				}))
		})
	},
})
