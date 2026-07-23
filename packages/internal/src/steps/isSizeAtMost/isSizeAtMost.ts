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
	/**
	 * ### Description:
	 * Checks that a size-bearing value such as a Map or Set has a `size` less than
	 * or equal to the specified maximum. The runtime reads `size` once and
	 * snapshots that value in the failure payload.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isSizeAtMost, set, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [set, string, isSizeAtMost] })
	 * const schema = v.set(v.string()).isSizeAtMost(3)
	 * const result = schema.execute(new Set(['a', 'b']))
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isSizeAtMost:expected_size_at_most'`: The observed size exceeds the maximum.
	 */
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
