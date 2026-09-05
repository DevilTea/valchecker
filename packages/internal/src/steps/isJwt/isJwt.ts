import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'
import { snapshotMessage } from '../../core/message'
import { isBase64UrlString } from '../isBase64Url/base64url'

type Meta = DefineStepMethodMeta<{
	Name: 'isJwt'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'isJwt:expected_jwt', { value: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the string is a structurally valid JWT using JWS Compact
	 * Serialization. The JOSE header and Claims Set must be valid UTF-8 JSON
	 * objects, the header must carry a non-empty string `alg`, and the signature
	 * must be empty exactly for `alg: "none"`. Signatures are not
	 * cryptographically verified and JWE is outside this step's contract.
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

const utf8Decoder = new TextDecoder('utf-8', { fatal: true })

function decodeBase64UrlUtf8(segment: string): string {
	const normalized = segment.replace(/-/g, '+')
		.replace(/_/g, '/')
	const padded = normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, '=')
	const binary = atob(padded)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++)
		bytes[i] = binary.charCodeAt(i)
	return utf8Decoder.decode(bytes)
}

function decodeJsonObject(segment: string): Record<string, unknown> | null {
	try {
		const decoded: unknown = JSON.parse(decodeBase64UrlUtf8(segment))
		return typeof decoded === 'object' && decoded !== null && !Array.isArray(decoded)
			? decoded as Record<string, unknown>
			: null
	}
	catch {
		return null
	}
}

function isJwtValue(value: string): boolean {
	const segments = value.split('.')
	if (segments.length !== 3)
		return false
	const header = segments[0] ?? ''
	const payload = segments[1] ?? ''
	const signature = segments[2] ?? ''
	// Segments are base64url, so they carry its length rule as well as its
	// alphabet: a length of `1 (mod 4)` cannot encode any byte. The header and
	// payload must also be non-empty, which the pattern alone does not require.
	if (header === '' || payload === '')
		return false
	if (!isBase64UrlString(header) || !isBase64UrlString(payload) || !isBase64UrlString(signature))
		return false

	const decodedHeader = decodeJsonObject(header)
	if (decodedHeader === null)
		return false
	const alg = decodedHeader.alg
	if (typeof alg !== 'string' || alg.length === 0)
		return false
	if (decodeJsonObject(payload) === null)
		return false

	return alg === 'none' ? signature === '' : signature !== ''
}

/* @__NO_SIDE_EFFECTS__ */
export const isJwt = implStepPlugin<PluginDef>({
	isJwt: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		const message = snapshotMessage(options?.message)
		addSuccessStep(value => isJwtValue(value)
			? success(value)
			: failure(
					createIssue({
						code: 'isJwt:expected_jwt',
						payload: { value },
						customMessage: message,
						defaultMessage: 'Expected a valid JWT.',
					}),
				))
	},
}, 'sync')
