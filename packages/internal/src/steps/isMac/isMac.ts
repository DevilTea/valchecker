import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

const pattern = /^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i

type Meta = DefineStepMethodMeta<{
	Name: 'isMac'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'isMac:expected_mac', { value: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the string is an EUI-48 MAC address written as six
	 * colon- or hyphen-separated hexadecimal octets. Matching is
	 * case-insensitive.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isMac, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isMac] })
	 * const result = v.string().isMac().execute('00:1A:2B:3C:4D:5E')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isMac:expected_mac'`: The string is not a valid MAC address.
	 */
	isMac: DefineStepMethod<
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
export const isMac = implStepPlugin<PluginDef>({
	isMac: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep(value => pattern.test(value)
			? success(value)
			: failure(
					createIssue({
						code: 'isMac:expected_mac',
						payload: { value },
						customMessage: options?.message,
						defaultMessage: 'Expected a valid MAC address.',
					}),
				))
	},
}, 'sync')
