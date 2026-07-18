import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue<T extends { length: number } = { length: number }> = ExecutionIssue<'isNotEmpty:expected_not_empty', { value: T, length: number }>
}

type Meta = DefineStepMethodMeta<{
	Name: 'isNotEmpty'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: { length: number } }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is not empty (`length > 0`). The runtime reads
	 * `length` once and snapshots it in the failure payload.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isNotEmpty, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isNotEmpty] })
	 * const schema = v.string().isNotEmpty()
	 * schema.execute('hello') // { value: 'hello' }
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isNotEmpty:expected_not_empty'`: The observed length is zero.
	 *   Payload: `{ value, length }`.
	 */
	isNotEmpty: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? InferOutput<this['CurrentValchecker']> extends infer CurrentOutput extends { length: number }
				? (options?: StepOptions<Internal.Issue<CurrentOutput>>) => Next<
						{ issue: Internal.Issue<CurrentOutput> },
						this['CurrentValchecker']
					>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isNotEmpty = implStepPlugin<PluginDef>({
	isNotEmpty: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep((value) => {
			const length = value.length
			return length > 0
				? success(value)
				: failure(createIssue({
						code: 'isNotEmpty:expected_not_empty',
						payload: { value, length },
						customMessage: options?.message,
						defaultMessage: 'Expected a non-empty value.',
					}))
		})
	},
})
