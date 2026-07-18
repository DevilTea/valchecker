import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferExecutionContext, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue = ExecutionIssue<'isDefined:expected_defined', { value: undefined }>
	export type HasTarget<T> = IsExactlyAnyOrUnknown<T> extends true ? true : undefined extends T ? true : false
	export type Narrow<T> = IsExactlyAnyOrUnknown<T> extends true
		? NonNullable<unknown> | null
		: Exclude<T, undefined>
}

type Meta = DefineStepMethodMeta<{
	Name: 'isDefined'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	isDefined: DefineStepMethod<
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
export const isDefined = implStepPlugin<PluginDef>({
	isDefined: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep(value => value !== undefined
			? success(value as any)
			: failure(createIssue({
					code: 'isDefined:expected_defined',
					payload: { value: value as undefined },
					customMessage: options?.message,
					defaultMessage: 'Expected a defined value.',
				})))
	},
})
