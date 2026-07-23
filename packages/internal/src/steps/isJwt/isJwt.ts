import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

function decodeBase64Url(segment: string): string {
	const normalized = segment.replace(/-/g, '+')
		.replace(/_/g, '/')
	const padded = normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, '=')
	return atob(padded)
}

function isJwtValue(value: string): boolean {
	const segments = value.split('.')
	if (segments.length !== 3)
		return false
	const base64Url = /^[\w-]+$/
	const header = segments[0] ?? ''
	const payload = segments[1] ?? ''
	const signature = segments[2] ?? ''
	if (!base64Url.test(header) || !base64Url.test(payload))
		return false
	if (signature !== '' && !base64Url.test(signature))
		return false
	try {
		const decoded: unknown = JSON.parse(decodeBase64Url(header))
		return typeof decoded === 'object'
			&& decoded !== null
			&& 'alg' in decoded
			&& typeof (decoded as { alg?: unknown }).alg === 'string'
	}
	catch {
		return false
	}
}

type Meta = DefineStepMethodMeta<{
	Name: 'isJwt'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'isJwt:expected_jwt', { value: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the string is a JSON Web Token: three base64url segments
	 * separated by dots. The header is base64url-decoded, parsed as JSON, and
	 * required to be an object carrying a string `alg`. The signature segment
	 * may be empty (an unsecured JWS).
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isJwt, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isJwt] })
	 * const result = v.string().isJwt().execute('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isJwt:expected_jwt'`: The string is not a valid JWT.
	 */
	isJwt: DefineStepMethod<
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
export const isJwt = implStepPlugin<PluginDef>({
	isJwt: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep(value => isJwtValue(value)
			? success(value)
			: failure(
					createIssue({
						code: 'isJwt:expected_jwt',
						payload: { value },
						customMessage: options?.message,
						defaultMessage: 'Expected a valid JWT.',
					}),
				))
	},
}, 'sync')
