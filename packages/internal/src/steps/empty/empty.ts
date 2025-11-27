import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue<T extends { length: number } = { length: number }> = ExecutionIssue<'empty:expected_empty', { value: T }>
}

type Meta = DefineStepMethodMeta<{
	Name: 'empty'
	ExpectedThis: DefineExpectedValchecker<{ output: { length: number } }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value has a length property and is empty (length === 0).
	 *
	 * ---
	 *
	 * ### Example:
	 * #### Usage with strings
	 * ```ts
	 * import { createValchecker, empty, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, empty] })
	 * const schema = v.string().empty()
	 * const result = schema.execute('')
	 * ```
	 *
	 * #### Usage with arrays
	 * ```ts
	 * import { createValchecker, empty, array, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [array, string, empty] })
	 * const schema = v.array(v.string()).empty()
	 * const result = schema.execute([])
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'empty:expected_empty'`: The value is not empty.
	 */
	empty: DefineStepMethod<
		Meta,
		this['This'] extends Meta['ExpectedThis']
			? InferOutput<this['This']> extends infer CurrentOutput extends{ length: number }
				? (message?: MessageHandler<Internal.Issue<CurrentOutput>>) => Next<
						{
							issue: Internal.Issue<CurrentOutput>
						},
						this['This']
					>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const empty = implStepPlugin<PluginDef>({
	empty: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [message],
	}) => {
		addSuccessStep(
			value => value.length === 0
				?	success(value)
				:	failure(
						createIssue({
							code: 'empty:expected_empty',
							payload: { value },
							customMessage: message,
							defaultMessage: 'Expected an empty value.',
						}),
					),
		)
	},
})
