import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'bigint'
	ExpectedThis: DefineExpectedValchecker<{ output: unknown }>
	SelfIssue: ExecutionIssue<'bigint:expected_bigint', { value: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is a bigint.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, bigint } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [bigint] })
	 * const schema = v.bigint()
	 * const result = schema.execute(42n)
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'bigint:expected_bigint'`: The value is not a bigint.
	 */
	bigint: DefineStepMethod<
		Meta,
		this['This'] extends Meta['ExpectedThis']
			?	IsExactlyAnyOrUnknown<InferOutput<this['This']>> extends true
				?	(message?: MessageHandler<Meta['SelfIssue']>) => Next<
						{
							output: bigint
							issue: Meta['SelfIssue']
						},
						this['This']
					>
				:	never
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const bigint = implStepPlugin<PluginDef>({
	bigint: ({
		utils: { addSuccessStep, success, resolveMessage, failure },
		params: [message],
	}) => {
		addSuccessStep(
			value => typeof value === 'bigint'
				?	success(value)
				:	failure({
						code: 'bigint:expected_bigint',
						payload: { value },
						message: resolveMessage(
							{
								code: 'bigint:expected_bigint',
								payload: { value },
							},
							message,
							'Expected a bigint.',
						),
					}),
		)
	},
})
