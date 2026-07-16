import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue<T extends { length: number } = { length: number }> = ExecutionIssue<'isEmpty:expected_empty', { value: T }>
}

type Meta = DefineStepMethodMeta<{
	Name: 'isEmpty'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: { length: number } }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is empty (`length === 0`).
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isEmpty, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isEmpty] })
	 * const schema = v.string().isEmpty()
	 * const result = schema.execute('')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isEmpty:expected_empty'`: The value is not empty.
	 */
	isEmpty: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? InferOutput<this['CurrentValchecker']> extends infer CurrentOutput extends { length: number }
				? (message?: MessageHandler<Internal.Issue<CurrentOutput>>) => Next<
						{ issue: Internal.Issue<CurrentOutput> },
						this['CurrentValchecker']
					>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isEmpty = implStepPlugin<PluginDef>({
	isEmpty: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [message],
	}) => {
		addSuccessStep(
			value => value.length === 0
				? success(value)
				: failure(
						createIssue({
							code: 'isEmpty:expected_empty',
							payload: { value },
							customMessage: message,
							defaultMessage: 'Expected an empty value.',
						}),
					),
		)
	},
})