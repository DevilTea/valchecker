import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferExecutionContext, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'
import { declareLiteralMembers } from '../literal/literal-members'

declare namespace Internal {
	export type Primitive = bigint | boolean | null | number | string | symbol | undefined
	export type Comparable<T> = IsExactlyAnyOrUnknown<T> extends true ? Primitive : Extract<T, Primitive>
	export type Narrow<T, Expected extends Primitive> = IsExactlyAnyOrUnknown<T> extends true ? Expected : Extract<T, Primitive> & Expected
	export type Values<T extends Primitive = Primitive> = readonly [T, ...T[]]
	export type Issue<T = unknown, Expected extends Primitive = Primitive> = ExecutionIssue<
		'isOneOf:expected_one_of',
		{ value: T, expectedValues: readonly Expected[] }
	>
}

type Meta = DefineStepMethodMeta<{
	Name: 'isOneOf'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is one of the given candidates, compared with
	 * `Object.is` semantics, and narrows the output to that literal union.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isOneOf, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isOneOf] })
	 * const schema = v.string().isOneOf(['red', 'green', 'blue'])
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isOneOf:expected_one_of'`: The value did not match any candidate.
	 */
	isOneOf: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? InferExecutionContext<This>['initial'] extends false
				? InferOutput<This> extends infer Output
					? [Internal.Comparable<Output>] extends [never]
							? never
							: <const Values extends Internal.Values<Internal.Comparable<Output>>>(
									values: Values,
									options?: StepOptions<Internal.Issue<Output, Values[number]>>,
								) => Next<{
									output: Internal.Narrow<Output, Values[number]>
									issue: Internal.Issue<Output, Values[number]>
									literalMembers: Values
								}, This>
					: never
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isOneOf = implStepPlugin<PluginDef>({
	isOneOf: ({
		utils: { addSuccessStep, success, createIssue, failure, setMetadata },
		params: [values, options],
	}) => {
		if (values.length === 0)
			throw new TypeError('isOneOf() requires at least one expected value.')
		const expectedValues: readonly (typeof values)[number][] = Object.freeze([...values])
		declareLiteralMembers(setMetadata, expectedValues)
		addSuccessStep((value) => {
			for (let index = 0; index < expectedValues.length; index++) {
				if (Object.is(value, expectedValues[index]))
					return success(value as (typeof values)[number])
			}
			return failure(createIssue({
				code: 'isOneOf:expected_one_of',
				payload: { value, expectedValues },
				customMessage: options?.message,
				defaultMessage: 'Expected one of the configured primitive values.',
			}))
		})
	},
}, 'sync')
