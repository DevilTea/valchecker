import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toBigint'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'toBigint:conversion_failed', { value: unknown, error: unknown }, 'operation'>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Converts the current value with JavaScript's native `BigInt()` conversion.
	 *
	 * This step is unavailable when the current output is already a bigint.
	 * Native conversion exceptions become structured `'operation'` issues; no
	 * additional parsing grammar or safety policy is applied.
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
	 * - `'toBigint:conversion_failed'`: JavaScript's native `BigInt()` conversion threw.
	 *   Payload: `{ value, error }`.
	 */
	toBigint: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? InferOutput<This> extends bigint
				? never
				: (options?: StepOptions<Meta['SelfIssue']>) => Next<{
						output: bigint
						issue: Meta['SelfIssue']
					}, This>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const toBigint = implStepPlugin<PluginDef>({
	toBigint: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep((value) => {
			try {
				// `value` is `unknown`; delegate directly to native `BigInt()`.
				// The cast only satisfies the lib's parameter type — invalid inputs
				// throw and are handled by the catch below.
				return success(BigInt(value as string | number | bigint | boolean))
			}
			catch (error) {
				return failure(createIssue({
					code: 'toBigint:conversion_failed',
					category: 'operation',
					payload: { value, error },
					customMessage: options?.message,
					defaultMessage: 'Expected a value convertible to bigint.',
				}))
			}
		})
	},
}, 'sync')
