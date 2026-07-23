import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'
import { CallbackErrorSentinel, runWithCallbackErrorSentinel } from '../callbackErrorSentinel'

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
	 * ### Description:
	 * Returns a sorted array without mutating the input. Comparator exceptions
	 * emit `toSorted:callback_failed` with the compared operands.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { array, createValchecker, number, toSorted } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [array, number, toSorted] })
	 * const schema = v.array(v.number()).toSorted({ compareFn: (a, b) => a - b })
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'toSorted:callback_failed'`: The comparator threw.
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

/* @__NO_SIDE_EFFECTS__ */
export const toSorted = implStepPlugin<PluginDef>({
	toSorted: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		const compareFn = options?.compareFn
		addSuccessStep((value) => {
			// No-comparator path assumes the ES2023 Array.prototype.toSorted
			// baseline. It intentionally stays outside the try/catch below: a
			// missing method is an environment error for the core boundary, not a
			// comparator failure to convert into a toSorted:callback_failed issue.
			if (compareFn == null)
				return success(value.toSorted())
			return runWithCallbackErrorSentinel(
				() => success(value.toSorted((left: unknown, right: unknown) => {
					try {
						return compareFn(left, right)
					}
					catch (error) {
						throw new CallbackErrorSentinel({ left, right }, error)
					}
				})),
				(context: { left: unknown, right: unknown }, error) => failure(createIssue({
					code: 'toSorted:callback_failed',
					category: 'operation',
					payload: { value, left: context.left, right: context.right, error },
					customMessage: options?.message,
					defaultMessage: 'Sort callback failed.',
				})),
			)
		})
	},
}, 'sync')
