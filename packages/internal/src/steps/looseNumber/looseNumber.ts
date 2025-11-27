import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'looseNumber'
	ExpectedThis: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'looseNumber:expected_number', { value: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is a number (`NaN` is allowed).
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, looseNumber } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [looseNumber] })
	 * const schema = v.looseNumber()
	 * const result = schema.execute(NaN)
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'looseNumber:expected_number'`: The value is not a number.
	 */
	looseNumber: DefineStepMethod<
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

// Implement Step Plugin Method
/* @__NO_SIDE_EFFECTS__ */
export const looseNumber = implStepPlugin<PluginDef>({
	looseNumber: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [message],
	}) => {
		addSuccessStep(
			value => typeof value === 'number'
				?	success(value)
				:	failure(
						createIssue({
							code: 'looseNumber:expected_number',
							payload: { value },
							customMessage: message,
							defaultMessage: 'Expected a number (NaN is allowed).',
						}),
					),
		)
	},
})
