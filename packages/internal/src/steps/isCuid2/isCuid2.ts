import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

const pattern = /^[a-z][0-9a-z]{1,31}$/

type Meta = DefineStepMethodMeta<{
	Name: 'isCuid2'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'isCuid2:expected_cuid2', { value: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the string is a CUID2 as produced by `@paralleldrive/cuid2`:
	 * a lowercase base-36 string starting with a letter, 2 to 32 characters
	 * long.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isCuid2, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isCuid2] })
	 * const result = v.string().isCuid2().execute('tz4a98xxat96iws9zmbrgj3a')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isCuid2:expected_cuid2'`: The string is not a valid CUID2.
	 */
	isCuid2: DefineStepMethod<
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
export const isCuid2 = implStepPlugin<PluginDef>({
	isCuid2: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep(value => pattern.test(value)
			? success(value)
			: failure(
					createIssue({
						code: 'isCuid2:expected_cuid2',
						payload: { value },
						customMessage: options?.message,
						defaultMessage: 'Expected a valid CUID2.',
					}),
				))
	},
}, 'sync')
