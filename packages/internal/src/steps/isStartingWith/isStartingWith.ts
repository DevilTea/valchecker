import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, StepOptions, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'isStartingWith'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'isStartingWith:expected_starting_with', { value: string, prefix: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the string starts with the specified prefix.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isStartingWith, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isStartingWith] })
	 * const schema = v.string().isStartingWith('hello')
	 * const result = schema.execute('hello world')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isStartingWith:expected_starting_with'`: The string does not start with the specified prefix.
	 */
	isStartingWith: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? (prefix: string, options?: StepOptions<Meta['SelfIssue']>) => Next<
					{ issue: Meta['SelfIssue'] },
					this['CurrentValchecker']
				>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isStartingWith = implStepPlugin<PluginDef>({
	isStartingWith: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [prefix, options],
	}) => {
		addSuccessStep(value => value.startsWith(prefix)
			? success(value)
			: failure(
					createIssue({
						code: 'isStartingWith:expected_starting_with',
						payload: { value, prefix },
						customMessage: options?.message,
						defaultMessage: `Expected the string to start with "${prefix}".`,
					}),
				))
	},
})
