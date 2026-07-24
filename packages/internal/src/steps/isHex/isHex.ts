import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

const pattern = /^[0-9a-f]+$/i

type Meta = DefineStepMethodMeta<{
	Name: 'isHex'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'isHex:expected_hex', { value: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the string is one or more hexadecimal digits. It does not
	 * accept a `0x` prefix, enforce an even length, or impose any other
	 * policy. Matching is case-insensitive.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isHex, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isHex] })
	 * const result = v.string().isHex().execute('deadBEEF')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isHex:expected_hex'`: The string is not a hexadecimal string.
	 */
	isHex: DefineStepMethod<
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
export const isHex = implStepPlugin<PluginDef>({
	isHex: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep(value => pattern.test(value)
			? success(value)
			: failure(
					createIssue({
						code: 'isHex:expected_hex',
						payload: { value },
						customMessage: options?.message,
						defaultMessage: 'Expected a hexadecimal string.',
					}),
				))
	},
}, 'sync')
