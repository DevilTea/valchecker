import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, StepOptions, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

const MIN_SAFE_BIGINT = BigInt(Number.MIN_SAFE_INTEGER)
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER)

type Meta = DefineStepMethodMeta<{
	Name: 'toSafeNumber'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: bigint }>
	SelfIssue: ExecutionIssue<
		'toSafeNumber:out_of_safe_integer_range',
		{ value: bigint, minimum: bigint, maximum: bigint }
	>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Converts a bigint to a number only when it is within JavaScript's safe integer range.
	 *
	 * Use `toNumber()` when native `Number(bigint)` precision loss is acceptable.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { bigint, createValchecker, toSafeNumber } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [bigint, toSafeNumber] })
	 * const result = v.bigint().toSafeNumber().execute(42n)
	 * // { value: 42 }
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'toSafeNumber:out_of_safe_integer_range'`: The bigint is outside `Number.MIN_SAFE_INTEGER` through `Number.MAX_SAFE_INTEGER`.
	 */
	toSafeNumber: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? (options?: StepOptions<Meta['SelfIssue']>) => Next<
					{
						output: number
						issue: Meta['SelfIssue']
					},
					this['CurrentValchecker']
				>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const toSafeNumber = implStepPlugin<PluginDef>({
	toSafeNumber: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep((value) => {
			if (value < MIN_SAFE_BIGINT || value > MAX_SAFE_BIGINT) {
				return failure(
					createIssue({
						code: 'toSafeNumber:out_of_safe_integer_range',
						payload: {
							value,
							minimum: MIN_SAFE_BIGINT,
							maximum: MAX_SAFE_BIGINT,
						},
						customMessage: options?.message,
						defaultMessage: 'Expected the bigint to be within the safe integer range.',
					}),
				)
			}

			return success(Number(value))
		})
	},
})
