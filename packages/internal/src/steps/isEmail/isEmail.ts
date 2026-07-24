import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

const pattern = /^[\w.!#$%&'*+/=?^`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i

type Meta = DefineStepMethodMeta<{
	Name: 'isEmail'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: ExecutionIssue<'isEmail:expected_email', { value: string }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the string is an email address using the pragmatic WHATWG
	 * HTML `<input type="email">` pattern. It is intentionally not a full RFC
	 * 5322 parser: it does not require a dot in the domain and rejects
	 * whitespace and a missing local or domain part.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isEmail, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isEmail] })
	 * const result = v.string().isEmail().execute('john.doe@example.com')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isEmail:expected_email'`: The string is not a valid email address.
	 */
	isEmail: DefineStepMethod<
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
export const isEmail = implStepPlugin<PluginDef>({
	isEmail: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep(value => pattern.test(value)
			? success(value)
			: failure(
					createIssue({
						code: 'isEmail:expected_email',
						payload: { value },
						customMessage: options?.message,
						defaultMessage: 'Expected a valid email address.',
					}),
				))
	},
}, 'sync')
