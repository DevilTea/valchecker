import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue<T extends { length: number } = { length: number }> = ExecutionIssue<
		'isLengthAtLeast:expected_length_at_least',
		{ value: T, minimumLength: number, length: number }
	>
}

type Meta = DefineStepMethodMeta<{
	Name: 'isLengthAtLeast'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: { length: number } }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value's observed `length` is greater than or equal to the
	 * specified minimum. The runtime reads `length` once and snapshots that value
	 * in the failure payload.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isLengthAtLeast, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isLengthAtLeast] })
	 * const schema = v.string().isLengthAtLeast(3)
	 * schema.execute('hello') // { value: 'hello' }
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isLengthAtLeast:expected_length_at_least'`: The observed length is below the minimum.
	 *   Payload: `{ value, minimumLength, length }`.
	 */
	isLengthAtLeast: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? InferOutput<this['CurrentValchecker']> extends infer CurrentOutput extends { length: number }
				? (minimum: number, options?: StepOptions<Internal.Issue<CurrentOutput>>) => Next<
						{ issue: Internal.Issue<CurrentOutput> },
						this['CurrentValchecker']
					>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isLengthAtLeast = implStepPlugin<PluginDef>({
	isLengthAtLeast: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [minimum, options],
	}) => {
		addSuccessStep((value) => {
			const length = value.length
			return length >= minimum
				? success(value)
				: failure(createIssue({
						code: 'isLengthAtLeast:expected_length_at_least',
						payload: { value, minimumLength: minimum, length },
						customMessage: options?.message,
						defaultMessage: `Expected a length of at least ${minimum}.`,
					}))
		})
	},
}, 'sync')
