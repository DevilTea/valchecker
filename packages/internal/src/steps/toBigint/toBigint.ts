import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toBigint'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'toBigint:invalid_bigint', { value: unknown, error: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Converts the current value with JavaScript's native `BigInt()` conversion.
	 *
	 * This step is available after any output that is not already a bigint. Native conversion errors are returned as structured validation issues. No additional parsing grammar or safety policy is applied.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, string, toBigint } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, toBigint] })
	 * const result = v.string().toBigint().execute('42')
	 * // { value: 42n }
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'toBigint:invalid_bigint'`: JavaScript's native `BigInt()` conversion threw an error.
	 */
	toBigint: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? InferOutput<This> extends bigint
				? never
				: (message?: MessageHandler<Meta['SelfIssue']>) => Next<
						{
							output: bigint
							issue: Meta['SelfIssue']
						},
						This
					>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const toBigint = implStepPlugin<PluginDef>({
	toBigint: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [message],
	}) => {
		addSuccessStep((value) => {
			try {
				return success(BigInt(value))
			}
			catch (error) {
				return failure(
					createIssue({
						code: 'toBigint:invalid_bigint',
						payload: { value, error },
						customMessage: message,
						defaultMessage: 'Expected a value convertible to bigint.',
					}),
				)
			}
		})
	},
})
