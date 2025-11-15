import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'string'
	ExpectedThis: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'string:expected_string', { value: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is a string.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string] })
	 * const schema = v.string()
	 * const result = schema.execute('hello')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'string:expected_string'`: The value is not a string.
	 */
	string: DefineStepMethod<
		Meta,
		this['This'] extends Meta['ExpectedThis']
			?	IsExactlyAnyOrUnknown<InferOutput<this['This']>> extends true
				?	(message?: MessageHandler<Meta['SelfIssue']>) => Next<
						{
							output: string
							issue: Meta['SelfIssue']
						},
						this['This']
					>
				:	never
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const string = implStepPlugin<PluginDef>({
	string: ({
		utils: { addSuccessStep, success, resolveMessage, failure },
		params: [message],
	}) => {
		addSuccessStep((value) => {
			// Inline type check for better performance
			if (typeof value === 'string') {
				return success(value)
			}
			return failure({
				code: 'string:expected_string',
				payload: { value },
				message: resolveMessage(
					{
						code: 'string:expected_string',
						payload: { value },
					},
					message,
					'Expected a string.',
				),
			})
		})
	},
})
