import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'isInteger'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: number }>
	SelfIssue: ExecutionIssue<'isInteger:expected_integer', { value: number }>
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
	 * import { createValchecker, isInteger, number } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [number, isInteger] })
	 * const schema = v.number().isInteger()
	 * const result = schema.execute(42)
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isInteger:expected_integer'`: The value is not an integer.
	 */
	isInteger: DefineStepMethod<
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
export const isInteger = implStepPlugin<PluginDef>({
	isInteger: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep(
			value => Number.isInteger(value)
				? success(value)
				: failure(
						createIssue({
							code: 'isInteger:expected_integer',
							payload: { value },
							customMessage: options?.message,
							defaultMessage: 'Expected an integer.',
						}),
					),
		)
	},
})
