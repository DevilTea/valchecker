import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export interface LengthValue { length: number }
	export interface SizeValue { size: number }
	export type Value = LengthValue | SizeValue
	export type LengthIssue<T extends LengthValue = LengthValue> = ExecutionIssue<'isNotEmpty:expected_not_empty', { value: T, length: number }>
	export type SizeIssue<T extends SizeValue = SizeValue> = ExecutionIssue<'isNotEmpty:expected_not_empty', { value: T, size: number }>
	export type Issue<T extends Value = Value> = T extends LengthValue
		? LengthIssue<T>
		: T extends SizeValue
			? SizeIssue<T>
			: never
}

type Meta = DefineStepMethodMeta<{
	Name: 'isNotEmpty'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: Internal.Value }>
	SelfIssue: Internal.LengthIssue | Internal.SizeIssue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the observed `length` or `size` is greater than zero. The
	 * runtime reads the relevant property once and snapshots it in the failure
	 * payload.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isNotEmpty, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isNotEmpty] })
	 * const schema = v.string().isNotEmpty()
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isNotEmpty:expected_not_empty'`: The observed `length` or `size` is zero.
	 */
	isNotEmpty: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? InferOutput<This> extends infer CurrentOutput extends Internal.Value
				? (options?: StepOptions<Internal.Issue<CurrentOutput>>) => Next<
						{ issue: Internal.Issue<CurrentOutput> },
						This
					>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isNotEmpty = implStepPlugin<PluginDef>({
	isNotEmpty: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep((value) => {
			// `value` is `LengthValue | SizeValue`; the runtime probes `.length`
			// first, then `.size`. Read both through a permissive view so the
			// property access type-checks without altering the runtime reads.
			const view = value as { length?: number, size?: number }
			const length = view.length
			if (typeof length === 'number') {
				return length > 0
					? success(value)
					: failure(createIssue({
							code: 'isNotEmpty:expected_not_empty',
							payload: { value: value as Internal.LengthValue, length },
							customMessage: options?.message,
							defaultMessage: 'Expected a non-empty value.',
						}))
			}

			const size = view.size as number
			return size > 0
				? success(value)
				: failure(createIssue({
						code: 'isNotEmpty:expected_not_empty',
						payload: { value: value as Internal.SizeValue, size },
						customMessage: options?.message,
						defaultMessage: 'Expected a non-empty value.',
					}))
		})
	},
}, 'sync')
