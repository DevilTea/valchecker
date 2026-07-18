import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue<T extends { size: number } = { size: number }> = ExecutionIssue<'isSizeExactly:expected_size_exactly', { value: T, expectedSize: number, size: number }>
}

type Meta = DefineStepMethodMeta<{
	Name: 'isSizeExactly'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: { size: number } }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	isSizeExactly: DefineStepMethod<Meta, this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
		? InferOutput<This> extends infer CurrentOutput extends { size: number }
			? (expectedSize: number, options?: StepOptions<Internal.Issue<CurrentOutput>>) => Next<{ issue: Internal.Issue<CurrentOutput> }, This>
			: never
		: never>
}

/* @__NO_SIDE_EFFECTS__ */
export const isSizeExactly = implStepPlugin<PluginDef>({
	isSizeExactly: ({ utils: { addSuccessStep, success, createIssue, failure }, params: [expectedSize, options] }) => {
		addSuccessStep((value) => {
			const size = value.size
			return size === expectedSize
				? success(value)
				: failure(createIssue({
						code: 'isSizeExactly:expected_size_exactly',
						payload: { value, expectedSize, size },
						customMessage: options?.message,
						defaultMessage: `Expected a size of exactly ${expectedSize}.`,
					}))
		})
	},
})
