import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, MessageHandler, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'isNaN'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: number }>
	SelfIssue: ExecutionIssue<'isNaN:expected_nan', { value: number }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the number is `NaN` using `Number.isNaN` semantics.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isNaN, number } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [number, isNaN] })
	 * const result = v.number().isNaN().execute(Number.NaN)
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isNaN:expected_nan'`: The number is not `NaN`.
	 */
	isNaN: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? (message?: MessageHandler<Meta['SelfIssue']>) => Next<
					{ issue: Meta['SelfIssue'] },
					this['CurrentValchecker']
				>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isNaN = implStepPlugin<PluginDef>({
	isNaN: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [message],
	}) => {
		addSuccessStep(value => Number.isNaN(value)
			? success(value)
			: failure(
					createIssue({
						code: 'isNaN:expected_nan',
						payload: { value },
						customMessage: message,
						defaultMessage: 'Expected NaN.',
					}),
				))
	},
})