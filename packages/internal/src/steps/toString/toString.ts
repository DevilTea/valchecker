import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, TStepPluginDef } from '../../core'
import type { OverloadParametersAndReturnType } from '../../shared'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue<Input = unknown> = ExecutionIssue<'toString:conversion_failed', { value: Input, error: unknown }, 'operation'>
}

type Meta = DefineStepMethodMeta<{
	Name: 'toString'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: { toString: (...params: any[]) => string } }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Converts the value to a string using its toString method.
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'toString:conversion_failed'`: The value's `toString` method threw.
	 */
	toString: this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
		? OverloadParametersAndReturnType<InferOutput<This>['toString']> extends infer Tuple
			? Tuple extends [params: any[], ret: any]
				? DefineStepMethod<
					Meta,
					(...params: Tuple[0]) => Next<{
						output: Tuple[1]
						issue: Internal.Issue<InferOutput<This>>
					}, This>
				>
				: never
			: never
		: never
}

/* @__NO_SIDE_EFFECTS__ */
export const toString = implStepPlugin<PluginDef>({
	toString: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params,
	}) => {
		addSuccessStep((value) => {
			try {
				return success(value.toString(...params))
			}
			catch (error) {
				return failure(createIssue({
					code: 'toString:conversion_failed',
					category: 'operation',
					payload: { value, error },
					defaultMessage: 'String conversion failed.',
				}))
			}
		})
	},
})