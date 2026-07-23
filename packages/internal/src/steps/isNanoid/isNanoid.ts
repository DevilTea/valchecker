import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

const pattern = /^[\w-]+$/

type Meta = DefineStepMethodMeta<{
	Name: 'isNanoid'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'isNanoid:expected_nanoid', { value: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the string uses only the default Nano ID alphabet
	 * (`A-Za-z0-9_-`). Length is not constrained because Nano ID size is
	 * configurable at generation time.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isNanoid, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isNanoid] })
	 * const result = v.string().isNanoid().execute('V1StGXR8_Z5jdHi6B-myT')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isNanoid:expected_nanoid'`: The string is not a valid Nano ID.
	 */
	isNanoid: DefineStepMethod<
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
export const isNanoid = implStepPlugin<PluginDef>({
	isNanoid: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep(value => pattern.test(value)
			? success(value)
			: failure(
					createIssue({
						code: 'isNanoid:expected_nanoid',
						payload: { value },
						customMessage: options?.message,
						defaultMessage: 'Expected a valid Nano ID.',
					}),
				))
	},
}, 'sync')
