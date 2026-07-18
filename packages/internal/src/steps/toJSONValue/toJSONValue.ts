import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, StepOptions, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toJSONValue'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'toJSONValue:invalid_json', { value: unknown, error: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Parses a JSON string into a JavaScript value. The type parameter specifies the expected output type and defaults to `unknown`.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, string, toJSONValue } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, toJSONValue] })
	 * const schema = v.string().toJSONValue<{ name: string }>()
	 * const result = schema.execute('{"name":"John"}')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'toJSONValue:invalid_json'`: The value is not a valid JSON string.
	 */
	toJSONValue: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? <T = unknown>(options?: StepOptions<Meta['SelfIssue']>) => Next<
					{ output: T, issue: Meta['SelfIssue'] },
					this['CurrentValchecker']
				>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const toJSONValue = implStepPlugin<PluginDef>({
	toJSONValue: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep((value) => {
			try {
				return success(JSON.parse(value))
			}
			catch (error) {
				return failure(
					createIssue({
						code: 'toJSONValue:invalid_json',
						payload: { value, error },
						customMessage: options?.message,
						defaultMessage: 'Expected a valid JSON string.',
					}),
				)
			}
		})
	},
})
