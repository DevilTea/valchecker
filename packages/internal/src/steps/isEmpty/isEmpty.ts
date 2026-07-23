import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export interface LengthValue { length: number }
	export interface SizeValue { size: number }
	export type Value = LengthValue | SizeValue
	export type LengthIssue<T extends LengthValue = LengthValue> = ExecutionIssue<'isEmpty:expected_empty', { value: T, length: number }>
	export type SizeIssue<T extends SizeValue = SizeValue> = ExecutionIssue<'isEmpty:expected_empty', { value: T, size: number }>
	export type Issue<T extends Value = Value> = T extends LengthValue
		? LengthIssue<T>
		: T extends SizeValue
			? SizeIssue<T>
			: never
}

type Meta = DefineStepMethodMeta<{
	Name: 'isEmpty'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: Internal.Value }>
	SelfIssue: Internal.LengthIssue | Internal.SizeIssue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the observed `length` or `size` equals zero. The runtime reads
	 * the relevant property once and snapshots it in the failure payload.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isEmpty, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isEmpty] })
	 * const schema = v.string().isEmpty()
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isEmpty:expected_empty'`: The observed `length` or `size` is not zero.
	 */
	isEmpty: DefineStepMethod<
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
export const isEmpty = implStepPlugin<PluginDef>({
	isEmpty: ({
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
				return length === 0
					? success(value)
					: failure(createIssue({
							code: 'isEmpty:expected_empty',
							payload: { value: value as Internal.LengthValue, length },
							customMessage: options?.message,
							defaultMessage: 'Expected an empty value.',
						}))
			}

			const size = view.size as number
			return size === 0
				? success(value)
				: failure(createIssue({
						code: 'isEmpty:expected_empty',
						payload: { value: value as Internal.SizeValue, size },
						customMessage: options?.message,
						defaultMessage: 'Expected an empty value.',
					}))
		})
	},
}, 'sync')
