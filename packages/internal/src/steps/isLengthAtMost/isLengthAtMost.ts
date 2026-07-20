import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
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
	/**
	 * ### Description:
	 * Checks that the value's observed `length` is less than or equal to the
	 * specified maximum. The runtime reads `length` once and snapshots that value
	 * in the failure payload.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isLengthAtMost, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isLengthAtMost] })
	 * const schema = v.string().isLengthAtMost(10)
	 * schema.execute('hello') // { value: 'hello' }
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isLengthAtMost:expected_length_at_most'`: The observed length exceeds the maximum.
	 *   Payload: `{ value, maximum, length }`.
	 */
	isLengthAtMost: DefineStepMethod<
		LengthAtMostMeta,
		this['CurrentValchecker'] extends LengthAtMostMeta['ExpectedCurrentValchecker']
			? InferOutput<this['CurrentValchecker']> extends infer CurrentOutput extends { length: number }
				? (maximum: number, options?: StepOptions<LengthAtMostInternal.Issue<CurrentOutput>>) => Next<
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
		params: [maximum, options],
	}) => {
		addSuccessStep((value) => {
			const length = value.length
			return length <= maximum
				? success(value)
				: failure(createIssue({
						code: 'isLengthAtMost:expected_length_at_most',
						payload: { value, maximum, length },
						customMessage: options?.message,
						defaultMessage: `Expected a length of at most ${maximum}.`,
					}))
		})
	},
}, 'sync')
