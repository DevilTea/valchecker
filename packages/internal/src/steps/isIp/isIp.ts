import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue = ExecutionIssue<'isIp:expected_ip', { value: string, version: 4 | 6 | undefined }>
	export interface Options extends StepOptions<Issue> {
		readonly version?: 4 | 6 | undefined
	}
}

function isIPv4(value: string): boolean {
	const parts = value.split('.')
	if (parts.length !== 4)
		return false
	return parts.every(part => /^(?:0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255)
}

function isIPv6(value: string): boolean {
	const halves = value.split('::')
	if (halves.length > 2)
		return false
	const compressed = halves.length === 2
	const leftRaw = halves[0] ?? ''
	const rightRaw = halves[1] ?? ''
	const left = leftRaw === '' ? [] : leftRaw.split(':')
	const right = compressed && rightRaw !== '' ? rightRaw.split(':') : []
	const groups = [...left, ...right]
	if (groups.includes(''))
		return false
	let hexCount = groups.length
	let units = groups.length
	const last = groups[groups.length - 1]
	if (last !== undefined && last.includes('.')) {
		if (!isIPv4(last))
			return false
		hexCount = groups.length - 1
		units = hexCount + 2
	}
	for (let index = 0; index < hexCount; index++) {
		if (!/^[0-9a-f]{1,4}$/i.test(groups[index] ?? ''))
			return false
	}
	return compressed ? units <= 7 : units === 8
}

function isIpValue(value: string, version: 4 | 6 | undefined): boolean {
	if (version === 4)
		return isIPv4(value)
	if (version === 6)
		return isIPv6(value)
	return isIPv4(value) || isIPv6(value)
}

type Meta = DefineStepMethodMeta<{
	Name: 'isIp'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the string is an IP address. By default both IPv4 and IPv6
	 * are accepted; restrict to one with the `version` option (`4` or `6`).
	 * IPv4 octets are range-checked (0-255, no leading zeros) and IPv6
	 * supports `::` zero-compression and an embedded IPv4 suffix. Zone
	 * identifiers are not accepted.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isIp, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isIp] })
	 * const result = v.string().isIp().execute('192.168.0.1')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isIp:expected_ip'`: The string is not a valid IP address.
	 */
	isIp: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? (options?: Internal.Options) => Next<
					{ issue: Meta['SelfIssue'] },
					this['CurrentValchecker']
				>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isIp = implStepPlugin<PluginDef>({
	isIp: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		const version = options?.version
		addSuccessStep(value => isIpValue(value, version)
			? success(value)
			: failure(
					createIssue({
						code: 'isIp:expected_ip',
						payload: { value, version },
						customMessage: options?.message,
						defaultMessage: 'Expected a valid IP address.',
					}),
				))
	},
}, 'sync')
