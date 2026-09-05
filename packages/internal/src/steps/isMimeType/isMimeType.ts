import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'
import { markIssueSnapshotPayload } from '../../core/core'
import { snapshotMessageOptions } from '../../core/message'

declare namespace Internal {
	export type Issue<T extends { type: string } = { type: string }> = ExecutionIssue<'isMimeType:unexpected_mime_type', { value: T, expected: string | string[], actual: string }>
}

type Meta = DefineStepMethodMeta<{
	Name: 'isMimeType'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: { type: string } }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that a value's `type` string matches one of the allowed MIME
	 * types. Pass a single type or a list; a trailing `/*` matches any subtype
	 * (for example `'image/*'`). Matching is case-insensitive, following MIME
	 * type semantics. The successful value is preserved. `File` and `Blob`
	 * outputs qualify because both expose a `type` string.
	 *
	 * Matching compares the bare `type/subtype` only and does not parse MIME
	 * parameters: `'text/plain'` does not match `'text/plain;charset=utf-8'`,
	 * though a `'text/*'` wildcard would. Wildcard matching still requires a
	 * syntactically valid, non-empty MIME type/subtype pair, so malformed values
	 * such as `'image/'` and `'image//x'` do not match `'image/*'`.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { blob, createValchecker, isMimeType } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [blob, isMimeType] })
	 * const schema = v.blob().isMimeType(['image/*', 'application/pdf'])
	 * const result = schema.execute(new Blob(['data'], { type: 'image/png' }))
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isMimeType:unexpected_mime_type'`: The value's `type` does not match any allowed MIME type.
	 */
	isMimeType: DefineStepMethod<Meta, this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
		? InferOutput<This> extends infer CurrentOutput extends { type: string }
			? (types: string | string[], options?: StepOptions<Internal.Issue<CurrentOutput>>) => Next<{ issue: Internal.Issue<CurrentOutput> }, This>
			: never
		: never>
}

function isMimeTokenCharacter(code: number): boolean {
	return code === 0x21 // !
		|| (code >= 0x23 && code <= 0x27) // # $ % & '
		|| (code >= 0x2A && code <= 0x2B) // * +
		|| (code >= 0x2D && code <= 0x2E) // - .
		|| (code >= 0x30 && code <= 0x39) // 0-9
		|| (code >= 0x41 && code <= 0x5A) // A-Z
		|| (code >= 0x5E && code <= 0x60) // ^ _ `
		|| (code >= 0x61 && code <= 0x7A) // a-z
		|| code === 0x7C // |
		|| code === 0x7E // ~
}

// Wildcard matching leaves parameters opaque, but the subtype before the first
// parameter marker must be a non-empty MIME token. The type half is already
// fixed by the matched family prefix.
function hasValidWildcardSubtype(actual: string, subtypeStart: number): boolean {
	if (subtypeStart === actual.length)
		return false

	for (let index = subtypeStart; index < actual.length; index++) {
		const code = actual.charCodeAt(index)
		if (code === 0x3B) // ; begins the intentionally unparsed parameter tail
			return index !== subtypeStart
		if (!isMimeTokenCharacter(code))
			return false
	}
	return true
}

function matchesMimeType(actual: string, pattern: string): boolean {
	const normalizedActual = actual.toLowerCase()
	const normalizedPattern = pattern.toLowerCase()
	if (normalizedPattern.endsWith('/*')) {
		const familyPrefix = normalizedPattern.slice(0, -1)
		return normalizedActual.startsWith(familyPrefix)
			&& hasValidWildcardSubtype(actual, familyPrefix.length)
	}
	return normalizedActual === normalizedPattern
}

/* @__NO_SIDE_EFFECTS__ */
export const isMimeType = implStepPlugin<PluginDef>({
	isMimeType: ({ utils: { addSuccessStep, success, createIssue, failure }, params: [types, options] }) => {
		const messageOptions = snapshotMessageOptions(options)
		const configuredAsList = Array.isArray(types)
		const patterns = configuredAsList ? [...types] : [types]
		if (patterns.length === 0)
			throw new TypeError('isMimeType() requires at least one MIME type.')
		const expectedSingle = configuredAsList ? undefined : patterns[0]!
		const defaultMessage = `Expected a MIME type matching ${patterns.join(', ')}.`
		addSuccessStep((value) => {
			const actual = value.type
			return patterns.some(pattern => matchesMimeType(actual, pattern))
				? success(value)
				: failure(createIssue({
						code: 'isMimeType:unexpected_mime_type',
						payload: configuredAsList
							? markIssueSnapshotPayload(
									{ value, expected: [...patterns], actual },
									{ expected: 'container' },
								)
							: { value, expected: expectedSingle!, actual },
						customMessage: messageOptions?.message,
						defaultMessage,
					}))
		})
	},
}, 'sync')
