import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, MessageHandler, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'endsWith'
	ExpectedThis: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'endsWith:expected_ends_with', { value: string, suffix: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the string ends with the specified suffix.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, string, endsWith } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, endsWith] })
	 * const schema = v.string().endsWith('.txt')
	 * const result = schema.execute('file.txt')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'endsWith:expected_ends_with'`: The string does not end with the specified suffix.
	 */
	endsWith: DefineStepMethod<
		Meta,
		this['This'] extends Meta['ExpectedThis']
			? (suffix: string, message?: MessageHandler<Meta['SelfIssue']>) => Next<
					{ issue: Meta['SelfIssue'] },
					this['This']
				>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const endsWith = implStepPlugin<PluginDef>({
	endsWith: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [suffix, message],
	}) => {
		addSuccessStep((value) => {
			return value.endsWith(suffix)
				? success(value)
				: failure(
						createIssue({
							code: 'endsWith:expected_ends_with',
							payload: { value, suffix },
							customMessage: message,
							defaultMessage: `Expected the string to end with "${suffix}".`,
						}),
					)
		})
	},
})
