import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferExecutionContext, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Primitive = bigint | boolean | null | number | string | symbol | undefined
	export type Comparable<T> = IsExactlyAnyOrUnknown<T> extends true ? Primitive : Extract<T, Primitive>
	export type Narrow<T, Expected extends Primitive> = IsExactlyAnyOrUnknown<T> extends true ? Expected : Extract<T, Primitive> & Expected
	export type Issue<T = unknown, Expected extends Primitive = Primitive> = ExecutionIssue<'isEqualTo:expected_equal_to', { value: T, expected: Expected }>
}

type Meta = DefineStepMethodMeta<{
	Name: 'isEqualTo'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	isEqualTo: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? InferExecutionContext<This>['initial'] extends false
				? InferOutput<This> extends infer Output
					? [Internal.Comparable<Output>] extends [never]
						? never
						: <const Expected extends Internal.Comparable<Output>>(
							expected: Expected,
							options?: StepOptions<Internal.Issue<Output, Expected>>,
						) => Next<{
							output: Internal.Narrow<Output, Expected>
							issue: Internal.Issue<Output, Expected>
						}, This>
					: never
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isEqualTo = implStepPlugin<PluginDef>({
	isEqualTo: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [expected, options],
	}) => {
		addSuccessStep(value => Object.is(value, expected)
			? success(value as any)
			: failure(createIssue({
					code: 'isEqualTo:expected_equal_to',
					payload: { value, expected } as any,
					customMessage: options?.message,
					defaultMessage: `Expected a value equal to ${String(expected)}.`,
				})))
	},
})
