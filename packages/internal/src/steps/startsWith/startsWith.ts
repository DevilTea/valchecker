import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, MessageHandler, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'startsWith'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'startsWith:expected_starts_with', { value: string, prefix: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the string starts with the specified prefix.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, string, startsWith } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, startsWith] })
	 * const schema = v.string().startsWith('hello')
	 * const result = schema.execute('hello world')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'startsWith:expected_starts_with'`: The string does not start with the specified prefix.
	 */
	startsWith: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? (prefix: string, message?: MessageHandler<Meta['SelfIssue']>) => Next<
					{ issue: Meta['SelfIssue'] },
					this['CurrentValchecker']
				>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const startsWith = implStepPlugin<PluginDef>({
	startsWith: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [prefix, message],
	}) => {
		addSuccessStep((value) => {
			return value.startsWith(prefix)
				? success(value)
				: failure(
						createIssue({
							code: 'startsWith:expected_starts_with',
							payload: { value, prefix },
							customMessage: message,
							defaultMessage: `Expected the string to start with "${prefix}".`,
						}),
					)
		})
	},
})
