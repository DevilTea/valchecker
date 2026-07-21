import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue<T extends { length: number } = { length: number }> = ExecutionIssue<
		'isLengthExactly:expected_length_exactly',
		{ value: T, expectedLength: number, length: number }
	>
}

type Meta = DefineStepMethodMeta<{
	Name: 'isLengthExactly'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: { length: number } }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * Checks that the observed `length` equals the expected length. The runtime
	 * reads `length` once and snapshots it in the failure payload.
	 *
	 * @example
	 * const schema = v.string().isLengthExactly(8)
	 *
	 * @issues `isLengthExactly:expected_length_exactly`
	 */
	isLengthExactly: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? InferOutput<this['CurrentValchecker']> extends infer CurrentOutput extends { length: number }
				? (expectedLength: number, options?: StepOptions<Internal.Issue<CurrentOutput>>) => Next<
						{ issue: Internal.Issue<CurrentOutput> },
						this['CurrentValchecker']
					>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isLengthExactly = implStepPlugin<PluginDef>({
	isLengthExactly: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [expectedLength, options],
	}) => {
		addSuccessStep((value) => {
			const length = value.length
			return length === expectedLength
				? success(value)
				: failure(createIssue({
						code: 'isLengthExactly:expected_length_exactly',
						payload: { value, expectedLength, length },
						customMessage: options?.message,
						defaultMessage: `Expected a length of exactly ${expectedLength}.`,
					}))
		})
	},
}, 'sync')
