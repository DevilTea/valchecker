import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

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

function matchesMimeType(actual: string, pattern: string): boolean {
	const normalizedActual = actual.toLowerCase()
	const normalizedPattern = pattern.toLowerCase()
	if (normalizedPattern.endsWith('/*'))
		return normalizedActual.startsWith(normalizedPattern.slice(0, -1))
	return normalizedActual === normalizedPattern
}

/* @__NO_SIDE_EFFECTS__ */
export const isMimeType = implStepPlugin<PluginDef>({
	isMimeType: ({ utils: { addSuccessStep, success, createIssue, failure }, params: [types, options] }) => {
		const patterns = Array.isArray(types) ? types : [types]
		addSuccessStep((value) => {
			const actual = value.type
			return patterns.some(pattern => matchesMimeType(actual, pattern))
				? success(value)
				: failure(createIssue({
						code: 'isMimeType:unexpected_mime_type',
						payload: { value, expected: types, actual },
						customMessage: options?.message,
						defaultMessage: `Expected a MIME type matching ${patterns.join(', ')}.`,
					}))
		})
	},
}, 'sync')
