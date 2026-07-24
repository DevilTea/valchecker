import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

const pattern = /^[0-9A-HJKMNP-TV-Z]{26}$/i

type Meta = DefineStepMethodMeta<{
	Name: 'isUlid'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'isUlid:expected_ulid', { value: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the string is a ULID: 26 characters of Crockford base32
	 * (the digits and uppercase letters excluding I, L, O, and U). Matching is
	 * case-insensitive.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isUlid, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isUlid] })
	 * const result = v.string().isUlid().execute('01ARZ3NDEKTSV4RRFFQ69G5FAV')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isUlid:expected_ulid'`: The string is not a valid ULID.
	 */
	isUlid: DefineStepMethod<
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
export const isUlid = implStepPlugin<PluginDef>({
	isUlid: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep(value => pattern.test(value)
			? success(value)
			: failure(
					createIssue({
						code: 'isUlid:expected_ulid',
						payload: { value },
						customMessage: options?.message,
						defaultMessage: 'Expected a valid ULID.',
					}),
				))
	},
}, 'sync')
