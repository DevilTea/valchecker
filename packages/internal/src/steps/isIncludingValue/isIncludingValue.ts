import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue<Input extends Map<any, any> = Map<any, any>> = ExecutionIssue<
		'isIncludingValue:expected_including_value',
		{ value: Input, expectedValue: Input extends Map<any, infer EntryValue> ? EntryValue : never }
	>
}

type Meta = DefineStepMethodMeta<{
	Name: 'isIncludingValue'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: Map<any, any> }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that a Map includes the expected value among its entry values using
	 * SameValueZero equality, so `NaN` matches `NaN`.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isIncludingValue, map, number, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [map, number, string, isIncludingValue] })
	 * const schema = v.map({ key: v.string(), value: v.number() }).isIncludingValue(1)
	 * const result = schema.execute(new Map([['id', 1]]))
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isIncludingValue:expected_including_value'`: The Map does not include the expected value.
	 */
	isIncludingValue: DefineStepMethod<Meta, this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
		? InferOutput<This> extends infer Input extends Map<any, any>
			? (
					expectedValue: Input extends Map<any, infer EntryValue> ? EntryValue : never,
					options?: StepOptions<Internal.Issue<Input>>,
				) => Next<{ issue: Internal.Issue<Input> }, This>
			: never
		: never>
}

function isSameValueZero(left: unknown, right: unknown): boolean {
	// eslint-disable-next-line no-self-compare -- intentional NaN self-comparison implementing SameValueZero identity (x !== x is true only for NaN)
	return left === right || (left !== left && right !== right)
}

/* @__NO_SIDE_EFFECTS__ */
export const isIncludingValue = implStepPlugin<PluginDef>({
	isIncludingValue: ({ utils: { addSuccessStep, success, createIssue, failure }, params: [expectedValue, options] }) => {
		addSuccessStep((value) => {
			for (const entryValue of value.values()) {
				if (isSameValueZero(entryValue, expectedValue))
					return success(value)
			}
			return failure(createIssue({
				code: 'isIncludingValue:expected_including_value',
				payload: { value, expectedValue },
				customMessage: options?.message,
				defaultMessage: 'Expected the Map to include the configured value.',
			}))
		})
	},
}, 'sync')
