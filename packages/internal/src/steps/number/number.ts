import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'number'
	ExpectedThis: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'number:expected_number', { value: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is a number (`NaN` is not allowed).
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, number } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [number] })
	 * const schema = v.number()
	 * const result = schema.execute(42)
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'number:expected_number'`: The value is not a number.
	 */
	number: DefineStepMethod<
		Meta,
		this['This'] extends Meta['ExpectedThis']
			?	IsExactlyAnyOrUnknown<InferOutput<this['This']>> extends true
				?	(message?: MessageHandler<Meta['SelfIssue']>) => Next<
						{
							output: number
							issue: Meta['SelfIssue']
						},
						this['This']
					>
				:	never
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const number = implStepPlugin<PluginDef>({
	number: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [message],
	}) => {
		addSuccessStep((value) => {
			// Inline type check and NaN check for better performance
			if (typeof value === 'number' && !Number.isNaN(value)) {
				return success(value)
			}
			return failure(
				createIssue({
					code: 'number:expected_number',
					payload: { value },
					customMessage: message,
					defaultMessage: 'Expected a number (NaN is not allowed).',
				}),
			)
		})
	},
})
