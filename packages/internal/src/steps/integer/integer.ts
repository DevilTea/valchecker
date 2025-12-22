import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, MessageHandler, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'integer'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: number }>
	SelfIssue: ExecutionIssue<'integer:expected_integer', { value: number }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the number is an integer.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, number, integer } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [number, integer] })
	 * const schema = v.number().integer()
	 * const result = schema.execute(42)
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'integer:expected_integer'`: The value is not an integer.
	 */
	integer: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? (message?: MessageHandler<Meta['SelfIssue']>) => Next<
					{
						issue: Meta['SelfIssue']
					},
					this['CurrentValchecker']
				>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const integer = implStepPlugin<PluginDef>({
	integer: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [message],
	}) => {
		addSuccessStep(
			value => Number.isInteger(value)
				?	success(value)
				:	failure(
						createIssue({
							code: 'integer:expected_integer',
							payload: { value },
							customMessage: message,
							defaultMessage: 'Expected an integer.',
						}),
					),
		)
	},
})
