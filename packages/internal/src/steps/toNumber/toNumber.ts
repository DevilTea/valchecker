import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toNumber'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'toNumber:conversion_failed', { value: unknown, error: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Converts the current value with JavaScript's native `Number()` coercion.
	 *
	 * This step is available after any output that is not already a number. It does not add finite-number, parsing, or precision-safety constraints. Values such as invalid numeric strings produce `NaN`, and large bigint values may lose precision, exactly as they do with `Number(value)`.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, string, toNumber } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, toNumber] })
	 * const result = v.string().toNumber().execute('42')
	 * // { value: 42 }
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'toNumber:conversion_failed'`: JavaScript's native `Number()` conversion threw an error.
	 */
	toNumber: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? InferOutput<This> extends number
				? never
				: (options?: StepOptions<Meta['SelfIssue']>) => Next<
						{
							output: number
							issue: Meta['SelfIssue']
						},
						This
					>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const toNumber = implStepPlugin<PluginDef>({
	toNumber: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep((value) => {
			try {
				return success(Number(value))
			}
			catch (error) {
				return failure(
					createIssue({
						code: 'toNumber:conversion_failed',
						payload: { value, error },
						customMessage: options?.message,
						defaultMessage: 'Expected a value convertible to number.',
					}),
				)
			}
		})
	},
})
