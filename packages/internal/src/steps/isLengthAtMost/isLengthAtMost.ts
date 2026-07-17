import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace LengthAtMostInternal {
	export type Issue<T extends { length: number } = { length: number }> = ExecutionIssue<
		'isLengthAtMost:expected_length_at_most',
		{ value: T, maximum: number, length: number }
	>
}

type LengthAtMostMeta = DefineStepMethodMeta<{
	Name: 'isLengthAtMost'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: { length: number } }>
	SelfIssue: LengthAtMostInternal.Issue
}>

interface LengthAtMostPluginDef extends TStepPluginDef {
	isLengthAtMost: DefineStepMethod<
		LengthAtMostMeta,
		this['CurrentValchecker'] extends LengthAtMostMeta['ExpectedCurrentValchecker']
			? InferOutput<this['CurrentValchecker']> extends infer CurrentOutput extends { length: number }
				? (maximum: number, message?: MessageHandler<LengthAtMostInternal.Issue<CurrentOutput>>) => Next<
					{ issue: LengthAtMostInternal.Issue<CurrentOutput> },
					this['CurrentValchecker']
				>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isLengthAtMost = implStepPlugin<LengthAtMostPluginDef>({
	isLengthAtMost: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [maximum, message],
	}) => {
		addSuccessStep((value) => {
			const length = value.length
			return length <= maximum
				? success(value)
				: failure(createIssue({
					code: 'isLengthAtMost:expected_length_at_most',
					payload: { value, maximum, length },
					customMessage: message,
					defaultMessage: `Expected a length of at most ${maximum}.`,
				}))
		})
	},
})
