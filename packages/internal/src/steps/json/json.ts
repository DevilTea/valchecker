import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, MessageHandler, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'json'
	ExpectedThis: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'json:invalid_json', { value: string, error: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is a valid JSON string that can be parsed.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, json, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, json] })
	 * const schema = v.string().json()
	 * const result = schema.execute('{"name": "John"}')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'json:invalid_json'`: The value is not a valid JSON string.
	 */
	json: DefineStepMethod<
		Meta,
		this['This'] extends Meta['ExpectedThis']
			?	(message?: MessageHandler<Meta['SelfIssue']>) => Next<
					{
						output: string
						issue: Meta['SelfIssue']
					},
					this['This']
				>
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const json = implStepPlugin<PluginDef>({
	json: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [message],
	}) => {
		addSuccessStep(
			(value) => {
				try {
					JSON.parse(value)
					return success(value)
				}
				catch (error) {
					return failure(
						createIssue({
							code: 'json:invalid_json',
							payload: { value, error },
							customMessage: message,
							defaultMessage: 'Expected a valid JSON string.',
						}),
					)
				}
			},
		)
	},
})
