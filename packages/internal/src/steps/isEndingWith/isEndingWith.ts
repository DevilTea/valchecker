import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'isEndingWith'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'isEndingWith:expected_ending_with', { value: string, suffix: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the string ends with the specified suffix.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isEndingWith, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isEndingWith] })
	 * const schema = v.string().isEndingWith('.txt')
	 * const result = schema.execute('file.txt')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isEndingWith:expected_ending_with'`: The string does not end with the specified suffix.
	 */
	isEndingWith: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? (suffix: string, options?: StepOptions<Meta['SelfIssue']>) => Next<
					{ issue: Meta['SelfIssue'] },
					this['CurrentValchecker']
				>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isEndingWith = implStepPlugin<PluginDef>({
	isEndingWith: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [suffix, options],
	}) => {
		addSuccessStep(value => value.endsWith(suffix)
			? success(value)
			: failure(
					createIssue({
						code: 'isEndingWith:expected_ending_with',
						payload: { value, suffix },
						customMessage: options?.message,
						defaultMessage: `Expected the string to end with "${suffix}".`,
					}),
				))
	},
})
