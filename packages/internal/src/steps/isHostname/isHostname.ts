import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'
import { snapshotMessage } from '../../core/message'

type Meta = DefineStepMethodMeta<{
	Name: 'isHostname'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'isHostname:expected_hostname', { value: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the string is an RFC 1123 hostname: dot-separated labels of
	 * 1 to 63 characters, each starting and ending with an alphanumeric
	 * character, with a total length of at most 253 characters. The final
	 * highest-level label cannot be entirely numeric, keeping host names
	 * distinct from dotted-decimal IPv4 text. Matching is case-insensitive.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isHostname, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isHostname] })
	 * const result = v.string().isHostname().execute('example.com')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isHostname:expected_hostname'`: The string is not a valid hostname.
	 */
	isHostname: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? (options?: StepOptions<Meta['SelfIssue']>) => Next<
					{ issue: Meta['SelfIssue'] },
					this['CurrentValchecker']
				>
			: never
	>
}

const pattern = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i

function hasAllNumericFinalLabel(value: string): boolean {
	for (let index = value.length - 1; index >= 0; index--) {
		const code = value.charCodeAt(index)
		if (code === 0x2E) // .
			return true
		if (code < 0x30 || code > 0x39) // 0-9
			return false
	}
	return true
}

/* @__NO_SIDE_EFFECTS__ */
export const isHostname = implStepPlugin<PluginDef>({
	isHostname: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		const message = snapshotMessage(options?.message)
		addSuccessStep(value => pattern.test(value) && !hasAllNumericFinalLabel(value)
			? success(value)
			: failure(
					createIssue({
						code: 'isHostname:expected_hostname',
						payload: { value },
						customMessage: message,
						defaultMessage: 'Expected a valid hostname.',
					}),
				))
	},
}, 'sync')
