import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'boolean'
	ExpectedThis: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'boolean:expected_boolean', { value: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is a boolean.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, boolean } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [boolean] })
	 * const schema = v.boolean()
	 * const result = schema.execute(true)
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'boolean:expected_boolean'`: The value is not a boolean.
	 */
	boolean: DefineStepMethod<
		Meta,
		this['This'] extends Meta['ExpectedThis']
			?	IsExactlyAnyOrUnknown<InferOutput<this['This']>> extends true
				?	(message?: MessageHandler<Meta['SelfIssue']>) => Next<
						{
							output: boolean
							issue: Meta['SelfIssue']
						},
						this['This']
					>
				:	never
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const boolean = implStepPlugin<PluginDef>({
	boolean: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [message],
	}) => {
		addSuccessStep(
			value => typeof value === 'boolean'
				?	success(value)
				:	failure(
						createIssue({
							code: 'boolean:expected_boolean',
							payload: { value },
							customMessage: message,
							defaultMessage: 'Expected a boolean.',
						}),
					),
		)
	},
})
