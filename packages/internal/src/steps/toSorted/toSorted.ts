import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue<Input extends any[] = any[], Item = Input[number]> = ExecutionIssue<
		'toSorted:callback_failed',
		{ value: Input, left: Item, right: Item, error: unknown },
		'operation'
	>
	export interface Options<Input extends any[] = any[]> extends StepOptions<Issue<Input>> {
		readonly compareFn?: ((left: Input[number], right: Input[number]) => number) | undefined
	}
}

type Meta = DefineStepMethodMeta<{
	Name: 'toSorted'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: any[] & { toSorted: (...params: any[]) => any } }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * Returns a sorted array without mutating the input. Comparator exceptions
	 * emit `toSorted:callback_failed` with the compared operands.
	 */
	toSorted: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? InferOutput<This> extends infer Input extends any[]
				? (options?: Internal.Options<Input>) => Next<{ output: Input[number][], issue: Internal.Issue<Input> }, This>
				: never
			: never
	>
}

class SortCallbackError {
	constructor(
		readonly left: unknown,
		readonly right: unknown,
		readonly error: unknown,
	) { }
}

/* @__NO_SIDE_EFFECTS__ */
export const toSorted = implStepPlugin<PluginDef>({
	toSorted: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		const compareFn = options?.compareFn
		addSuccessStep((value) => {
			if (compareFn == null)
				return success(value.toSorted())
			try {
				return success(value.toSorted((left: unknown, right: unknown) => {
					try {
						return compareFn(left, right)
					}
					catch (error) {
						throw new SortCallbackError(left, right, error)
					}
				}))
			}
			catch (error) {
				if (!(error instanceof SortCallbackError))
					throw error
				return failure(createIssue({
					code: 'toSorted:callback_failed',
					category: 'operation',
					payload: { value, left: error.left, right: error.right, error: error.error },
					customMessage: options?.message,
					defaultMessage: 'Sort callback failed.',
				}))
			}
		})
	},
}, 'sync')
