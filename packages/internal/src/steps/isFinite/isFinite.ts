import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'isFinite'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: number }>
	SelfIssue: ExecutionIssue<'isFinite:expected_finite', { value: number }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the number is finite.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isFinite, number } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [number, isFinite] })
	 * const result = v.number().isFinite().execute(42)
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isFinite:expected_finite'`: The number is `NaN`, `Infinity`, or `-Infinity`.
	 */
	isFinite: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? (options?: StepOptions<Meta['SelfIssue']>) => Next<
					{ issue: Meta['SelfIssue'] },
					this['CurrentValchecker']
				>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isFinite = implStepPlugin<PluginDef>({
	isFinite: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep(value => Number.isFinite(value)
			? success(value)
			: failure(
					createIssue({
						code: 'isFinite:expected_finite',
						payload: { value },
						customMessage: options?.message,
						defaultMessage: 'Expected a finite number.',
					}),
				))
	},
})
