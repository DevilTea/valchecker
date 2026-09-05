import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'
import { snapshotMessage } from '../../core/message'
import { isBase64UrlString } from './base64url'

type Meta = DefineStepMethodMeta<{
	Name: 'isBase64Url'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'isBase64Url:expected_base64_url', { value: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the string is unpadded RFC 4648 §5 base64url, using the
	 * URL- and filename-safe alphabet (`-` and `_` instead of `+` and `/`)
	 * with no `=` padding. The empty string is accepted.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isBase64Url, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isBase64Url] })
	 * const result = v.string().isBase64Url().execute('aGVsbG8')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isBase64Url:expected_base64_url'`: The string is not a valid base64url string.
	 */
	isBase64Url: DefineStepMethod<
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
export const isBase64Url = implStepPlugin<PluginDef>({
	isBase64Url: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		const message = snapshotMessage(options?.message)
		addSuccessStep(value => isBase64UrlString(value)
			? success(value)
			: failure(
					createIssue({
						code: 'isBase64Url:expected_base64_url',
						payload: { value },
						customMessage: message,
						defaultMessage: 'Expected a valid base64url string.',
					}),
				))
	},
}, 'sync')
