import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type LengthValue = { length: number }
	export type SizeValue = { size: number }
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
	 * Checks that the observed `length` or `size` equals zero. The runtime reads
	 * the relevant property once and snapshots it in the failure payload.
	 *
	 * @issues `isEmpty:expected_empty`
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
			const length = value.length
			if (typeof length === 'number') {
				return length === 0
					? success(value)
					: failure(createIssue({
							code: 'isEmpty:expected_empty',
							payload: { value, length },
							customMessage: options?.message,
							defaultMessage: 'Expected an empty value.',
						}))
			}

			const size = value.size
			return size === 0
				? success(value)
				: failure(createIssue({
						code: 'isEmpty:expected_empty',
						payload: { value, size },
						customMessage: options?.message,
						defaultMessage: 'Expected an empty value.',
					}))
		})
	},
})
