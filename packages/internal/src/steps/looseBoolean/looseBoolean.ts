import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'looseBoolean'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'looseBoolean:expected_boolean', { value: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is a boolean or a string compatible with TypeScript's `${boolean}` template literal type, then normalizes the output to a boolean.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, looseBoolean } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [looseBoolean] })
	 * const result = v.looseBoolean().execute('true')
	 * // { value: true }
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'looseBoolean:expected_boolean'`: The value is neither a boolean nor `"true"` or `"false"`.
	 */
	looseBoolean: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				? (message?: MessageHandler<Meta['SelfIssue']>) => Next<
						{ output: boolean, issue: Meta['SelfIssue'] },
						this['CurrentValchecker']
					>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const looseBoolean = implStepPlugin<PluginDef>({
	looseBoolean: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [message],
	}) => {
		addSuccessStep((value) => {
			if (typeof value === 'boolean') {
				return success(value)
			}
			if (value === 'true') {
				return success(true)
			}
			if (value === 'false') {
				return success(false)
			}
			return failure(
				createIssue({
					code: 'looseBoolean:expected_boolean',
					payload: { value },
					customMessage: message,
					defaultMessage: 'Expected a boolean or boolean string.',
				}),
			)
		})
	},
})