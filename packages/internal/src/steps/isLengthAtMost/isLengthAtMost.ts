import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue<T extends { length: number } = { length: number }> = ExecutionIssue<
		'isLengthAtMost:expected_length_at_most',
		{ value: T, maximum: number }
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
	 * Checks that the value's length is less than or equal to the specified maximum.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isLengthAtMost, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isLengthAtMost] })
	 * const schema = v.string().isLengthAtMost(10)
	 * const result = schema.execute('hello')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isLengthAtMost:expected_length_at_most'`: The value is longer than the maximum length.
	 */
	isLengthAtMost: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? InferOutput<this['CurrentValchecker']> extends infer CurrentOutput extends { length: number }
				? (maximum: number, message?: MessageHandler<Internal.Issue<CurrentOutput>>) => Next<
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
		params: [maximum, message],
	}) => {
		addSuccessStep(value => value.length <= maximum
			? success(value)
			: failure(
					createIssue({
						code: 'isLengthAtMost:expected_length_at_most',
						payload: { value, maximum },
						customMessage: message,
						defaultMessage: `Expected a length of at most ${maximum}.`,
					}),
				))
	},
})
