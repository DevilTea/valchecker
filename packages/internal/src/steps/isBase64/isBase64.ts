import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

const pattern = /^(?:[A-Z0-9+/]{4})*(?:[A-Z0-9+/]{2}==|[A-Z0-9+/]{3}=)?$/i

type Meta = DefineStepMethodMeta<{
	Name: 'isBase64'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'isBase64:expected_base64', { value: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the string is standard RFC 4648 base64 with canonical
	 * padding. The empty string is accepted because it is the encoding of an
	 * empty input; no non-empty policy is added.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isBase64, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isBase64] })
	 * const result = v.string().isBase64().execute('aGVsbG8=')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isBase64:expected_base64'`: The string is not a valid base64 string.
	 */
	isBase64: DefineStepMethod<
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
export const isBase64 = implStepPlugin<PluginDef>({
	isBase64: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep(value => pattern.test(value)
			? success(value)
			: failure(
					createIssue({
						code: 'isBase64:expected_base64',
						payload: { value },
						customMessage: options?.message,
						defaultMessage: 'Expected a valid base64 string.',
					}),
				))
	},
}, 'sync')
