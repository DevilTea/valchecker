import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'
import { snapshotMessage } from '../../core/message'

declare namespace Internal {
	export type Issue<T extends { length: number } = { length: number }> = ExecutionIssue<
		'isLengthAtMost:expected_length_at_most',
		{ value: T, maximumLength: number, length: number }
	>
}

type Meta = DefineStepMethodMeta<{
	Name: 'isLengthAtMost'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: { length: number } }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
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
	 *   Payload: `{ value, maximumLength, length }`.
	 */
	isLengthAtMost: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? InferOutput<this['CurrentValchecker']> extends infer CurrentOutput extends { length: number }
				? (maximum: number, options?: StepOptions<Internal.Issue<CurrentOutput>>) => Next<
						{ issue: Internal.Issue<CurrentOutput> },
						this['CurrentValchecker']
					>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isLengthAtMost = implStepPlugin<PluginDef>({
	isLengthAtMost: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [maximum, options],
	}) => {
		const message = snapshotMessage(options?.message)
		addSuccessStep((value) => {
			const length = value.length
			return length <= maximum
				? success(value)
				: failure(createIssue({
						code: 'isLengthAtMost:expected_length_at_most',
						payload: { value, maximumLength: maximum, length },
						customMessage: message,
						defaultMessage: `Expected a length of at most ${maximum}.`,
					}))
		})
	},
}, 'sync')
