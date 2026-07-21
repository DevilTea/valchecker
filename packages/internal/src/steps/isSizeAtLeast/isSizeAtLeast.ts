import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue<T extends { size: number } = { size: number }> = ExecutionIssue<'isSizeAtLeast:expected_size_at_least', { value: T, minimumSize: number, size: number }>
}

type Meta = DefineStepMethodMeta<{
	Name: 'isSizeAtLeast'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: { size: number } }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	isSizeAtLeast: DefineStepMethod<Meta, this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
		? InferOutput<This> extends infer CurrentOutput extends { size: number }
			? (minimumSize: number, options?: StepOptions<Internal.Issue<CurrentOutput>>) => Next<{ issue: Internal.Issue<CurrentOutput> }, This>
			: never
		: never>
}

/* @__NO_SIDE_EFFECTS__ */
export const isSizeAtLeast = implStepPlugin<PluginDef>({
	isSizeAtLeast: ({ utils: { addSuccessStep, success, createIssue, failure }, params: [minimumSize, options] }) => {
		addSuccessStep((value) => {
			const size = value.size
			return size >= minimumSize
				? success(value)
				: failure(createIssue({
						code: 'isSizeAtLeast:expected_size_at_least',
						payload: { value, minimumSize, size },
						customMessage: options?.message,
						defaultMessage: `Expected a size of at least ${minimumSize}.`,
					}))
		})
	},
}, 'sync')
