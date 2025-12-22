import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, MessageHandler, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'never'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'never:expected_never', { value: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Fails for any value. (Output type is `never`)
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, never } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [never] })
	 * const schema = v.never()
	 * const result = schema.execute('anything') // will always fail
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'never:expected_never'`: The value is not never.
	 */
	never: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			?	(message?: MessageHandler<Meta['SelfIssue']>) => Next<
					{
						output: never
						issue: Meta['SelfIssue']
					},
					this['CurrentValchecker']
				>
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const never = implStepPlugin<PluginDef>({
	never: ({
		utils: { addSuccessStep, createIssue, failure },
		params: [message],
	}) => {
		addSuccessStep(
			value => failure(
				createIssue({
					code: 'never:expected_never',
					payload: { value },
					customMessage: message,
					defaultMessage: 'Expected never.',
				}),
			),
		)
	},
})
