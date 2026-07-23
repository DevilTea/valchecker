import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'isSafeInteger'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: number }>
	SelfIssue: ExecutionIssue<'isSafeInteger:expected_safe_integer', { value: number }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the number is a safe integer using `Number.isSafeInteger`.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isSafeInteger, number } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [number, isSafeInteger] })
	 * const schema = v.number().isSafeInteger()
	 * const result = schema.execute(42)
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isSafeInteger:expected_safe_integer'`: The value is not a safe integer.
	 */
	isSafeInteger: DefineStepMethod<Meta, this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
		? (options?: StepOptions<Meta['SelfIssue']>) => Next<{ issue: Meta['SelfIssue'] }, this['CurrentValchecker']>
		: never>
}

/* @__NO_SIDE_EFFECTS__ */
export const isSafeInteger = implStepPlugin<PluginDef>({
	isSafeInteger: ({ utils: { addSuccessStep, success, createIssue, failure }, params: [options] }) => {
		addSuccessStep(value => Number.isSafeInteger(value)
			? success(value)
			: failure(createIssue({
					code: 'isSafeInteger:expected_safe_integer',
					payload: { value },
					customMessage: options?.message,
					defaultMessage: 'Expected a safe integer.',
				})))
	},
}, 'sync')
