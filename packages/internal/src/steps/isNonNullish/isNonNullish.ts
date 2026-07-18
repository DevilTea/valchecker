import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferExecutionContext, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue = ExecutionIssue<'isNonNullish:expected_non_nullish', { value: null | undefined }>
	export type HasTarget<T> = IsExactlyAnyOrUnknown<T> extends true
		? true
		: null extends T
			? true
			: undefined extends T
				? true
				: false
	export type Narrow<T> = IsExactlyAnyOrUnknown<T> extends true
		? NonNullable<unknown>
		: Exclude<T, null | undefined>
}

type Meta = DefineStepMethodMeta<{
	Name: 'isNonNullish'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	isNonNullish: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? InferExecutionContext<This>['initial'] extends false
				? InferOutput<This> extends infer Output
					? Internal.HasTarget<Output> extends true
						? (options?: StepOptions<Internal.Issue>) => Next<{
							output: Internal.Narrow<Output>
							issue: Internal.Issue
						}, This>
						: never
					: never
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isNonNullish = implStepPlugin<PluginDef>({
	isNonNullish: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep(value => value !== null && value !== undefined
			? success(value as any)
			: failure(createIssue({
					code: 'isNonNullish:expected_non_nullish',
					payload: { value: value as null | undefined },
					customMessage: options?.message,
					defaultMessage: 'Expected a non-nullish value.',
				})))
	},
})
