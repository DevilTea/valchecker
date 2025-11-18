import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'null'
	ExpectedThis: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'null:expected_null', { value: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is null.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, null_ } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [null_] })
	 * const schema = v.null_()
	 * const result = schema.execute(null)
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'null:expected_null'`: The value is not null.
	 */
	null: DefineStepMethod<
		Meta,
		this['This'] extends Meta['ExpectedThis']
			?	IsExactlyAnyOrUnknown<InferOutput<this['This']>> extends true
				?	(message?: MessageHandler<Meta['SelfIssue']>) => Next<
						{
							output: null
							issue: Meta['SelfIssue']
						},
						this['This']
					>
				:	never
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const null_ = implStepPlugin<PluginDef>({
	null: ({
		utils: { addSuccessStep, success, resolveMessage, failure },
		params: [message],
	}) => {
		addSuccessStep(
			value => value === null
				?	success(value)
				:	failure({
						code: 'null:expected_null',
						payload: { value },
						message: resolveMessage(
							{
								code: 'null:expected_null',
								payload: { value },
							},
							message,
							'Expected null.',
						),
					}),
		)
	},
})
