import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace LengthAtLeastInternal {
	export type Issue<T extends { length: number } = { length: number }> = ExecutionIssue<
		'isLengthAtLeast:expected_length_at_least',
		{ value: T, minimum: number }
	>
}

type LengthAtLeastMeta = DefineStepMethodMeta<{
	Name: 'isLengthAtLeast'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: { length: number } }>
	SelfIssue: LengthAtLeastInternal.Issue
}>

interface LengthAtLeastPluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value's length is greater than or equal to the specified minimum.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isLengthAtLeast, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isLengthAtLeast] })
	 * const schema = v.string().isLengthAtLeast(3)
	 * const result = schema.execute('hello')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isLengthAtLeast:expected_length_at_least'`: The value is shorter than the minimum length.
	 */
	isLengthAtLeast: DefineStepMethod<
		LengthAtLeastMeta,
		this['CurrentValchecker'] extends LengthAtLeastMeta['ExpectedCurrentValchecker']
			? InferOutput<this['CurrentValchecker']> extends infer CurrentOutput extends { length: number }
				? (minimum: number, message?: MessageHandler<LengthAtLeastInternal.Issue<CurrentOutput>>) => Next<
						{ issue: LengthAtLeastInternal.Issue<CurrentOutput> },
						this['CurrentValchecker']
					>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isLengthAtLeast = implStepPlugin<LengthAtLeastPluginDef>({
	isLengthAtLeast: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [minimum, message],
	}) => {
		addSuccessStep(value => value.length >= minimum
			? success(value)
			: failure(
					createIssue({
						code: 'isLengthAtLeast:expected_length_at_least',
						payload: { value, minimum },
						customMessage: message,
						defaultMessage: `Expected a length of at least ${minimum}.`,
					}),
				))
	},
})
