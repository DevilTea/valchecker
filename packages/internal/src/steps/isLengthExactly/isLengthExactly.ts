import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue<T extends { length: number } = { length: number }> = ExecutionIssue<
		'isLengthExactly:expected_length_exactly',
		{ value: T, expectedLength: number, length: number }
	>
}

type Meta = DefineStepMethodMeta<{
	Name: 'isLengthExactly'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: { length: number } }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value's observed `length` equals the expected length. The
	 * runtime reads `length` once and snapshots that value in the failure payload.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isLengthExactly, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isLengthExactly] })
	 * const schema = v.string().isLengthExactly(8)
	 * const result = schema.execute('password')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isLengthExactly:expected_length_exactly'`: The observed length is not exactly the expected length.
	 *   Payload: `{ value, expectedLength, length }`.
	 */
	isLengthExactly: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? InferOutput<this['CurrentValchecker']> extends infer CurrentOutput extends { length: number }
				? (expectedLength: number, options?: StepOptions<Internal.Issue<CurrentOutput>>) => Next<
						{ issue: Internal.Issue<CurrentOutput> },
						this['CurrentValchecker']
					>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isLengthExactly = implStepPlugin<PluginDef>({
	isLengthExactly: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [expectedLength, options],
	}) => {
		addSuccessStep((value) => {
			const length = value.length
			return length === expectedLength
				? success(value)
				: failure(createIssue({
						code: 'isLengthExactly:expected_length_exactly',
						payload: { value, expectedLength, length },
						customMessage: options?.message,
						defaultMessage: `Expected a length of exactly ${expectedLength}.`,
					}))
		})
	},
}, 'sync')
