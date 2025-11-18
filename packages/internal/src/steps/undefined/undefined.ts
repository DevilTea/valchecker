import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'undefined'
	ExpectedThis: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'undefined:expected_undefined', { value: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is undefined.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, undefined_ } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [undefined_] })
	 * const schema = v.undefined_()
	 * const result = schema.execute(undefined)
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'undefined:expected_undefined'`: The value is not undefined.
	 */
	undefined: DefineStepMethod<
		Meta,
		this['This'] extends Meta['ExpectedThis']
			?	IsExactlyAnyOrUnknown<InferOutput<this['This']>> extends true
				?	(message?: MessageHandler<Meta['SelfIssue']>) => Next<
						{
							output: undefined
							issue: Meta['SelfIssue']
						},
						this['This']
					>
				:	never
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const undefined_ = implStepPlugin<PluginDef>({
	undefined: ({
		utils: { addSuccessStep, success, resolveMessage, failure },
		params: [message],
	}) => {
		addSuccessStep(
			value => value === void 0
				?	success(value)
				:	failure({
						code: 'undefined:expected_undefined',
						payload: { value },
						message: resolveMessage(
							{
								code: 'undefined:expected_undefined',
								payload: { value },
							},
							message,
							'Expected undefined.',
						),
					}),
		)
	},
})
