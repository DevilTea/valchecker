import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, MessageHandler, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'parseJSON'
	ExpectedThis: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'parseJSON:invalid_json', { value: unknown, error: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Parses a JSON string into a JavaScript value. The type parameter specifies the expected output type (defaults to unknown).
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, parseJSON, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, parseJSON] })
	 * const schema = v.string().parseJSON<{ name: string; age: number }>()
	 * const result = schema.execute('{"name": "John", "age": 30}')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'parseJSON:invalid_json'`: The value is not a valid JSON string.
	 */
	parseJSON: DefineStepMethod<
		Meta,
		this['This'] extends Meta['ExpectedThis']
			?	<T = unknown>(message?: MessageHandler<Meta['SelfIssue']>) => Next<
					{
						output: T
						issue: Meta['SelfIssue']
					},
					this['This']
				>
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const parseJSON = implStepPlugin<PluginDef>({
	parseJSON: ({
		utils: { addSuccessStep, success, resolveMessage, failure },
		params: [message],
	}) => {
		addSuccessStep(
			(value) => {
				try {
					const parsed = JSON.parse(value)
					return success(parsed)
				}
				catch (error) {
					return failure({
						code: 'parseJSON:invalid_json',
						payload: { value, error },
						message: resolveMessage(
							{
								code: 'parseJSON:invalid_json',
								payload: { value },
							},
							message,
							'Expected a valid JSON string.',
						),
					})
				}
			},
		)
	},
})
