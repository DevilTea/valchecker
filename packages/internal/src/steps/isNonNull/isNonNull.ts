import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferExecutionContext, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue = ExecutionIssue<'isNonNull:expected_non_null', { value: null }>
	export type HasTarget<T> = IsExactlyAnyOrUnknown<T> extends true ? true : null extends T ? true : false
	export type Narrow<T> = IsExactlyAnyOrUnknown<T> extends true
		? NonNullable<unknown> | undefined
		: Exclude<T, null>
}

type Meta = DefineStepMethodMeta<{
	Name: 'isNonNull'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is not `null` and narrows the output by removing
	 * `null`. An `undefined` value passes and is preserved.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isNonNull, unknown } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [unknown, isNonNull] })
	 * const schema = v.unknown().isNonNull()
	 * const result = schema.execute('value')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isNonNull:expected_non_null'`: The value is `null`.
	 */
	isNonNull: DefineStepMethod<
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
export const isNonNull = implStepPlugin<PluginDef>({
	isNonNull: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep(value => value !== null
			? success(value as any)
			: failure(createIssue({
					code: 'isNonNull:expected_non_null',
					payload: { value: value as null },
					customMessage: options?.message,
					defaultMessage: 'Expected a non-null value.',
				})))
	},
}, 'sync')
