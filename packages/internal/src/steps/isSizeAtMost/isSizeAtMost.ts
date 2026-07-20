import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue<T extends { size: number } = { size: number }> = ExecutionIssue<'isSizeAtMost:expected_size_at_most', { value: T, maximumSize: number, size: number }>
}

type Meta = DefineStepMethodMeta<{
	Name: 'isSizeAtMost'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: { size: number } }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	isSizeAtMost: DefineStepMethod<Meta, this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
		? InferOutput<This> extends infer CurrentOutput extends { size: number }
			? (maximumSize: number, options?: StepOptions<Internal.Issue<CurrentOutput>>) => Next<{ issue: Internal.Issue<CurrentOutput> }, This>
			: never
		: never>
}

/* @__NO_SIDE_EFFECTS__ */
export const isSizeAtMost = implStepPlugin<PluginDef>({
	isSizeAtMost: ({ utils: { addSuccessStep, success, createIssue, failure }, params: [maximumSize, options] }) => {
		addSuccessStep((value) => {
			const size = value.size
			return size <= maximumSize
				? success(value)
				: failure(createIssue({
						code: 'isSizeAtMost:expected_size_at_most',
						payload: { value, maximumSize, size },
						customMessage: options?.message,
						defaultMessage: `Expected a size of at most ${maximumSize}.`,
					}))
		})
	},
}, 'sync')
