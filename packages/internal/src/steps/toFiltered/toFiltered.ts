import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue<Input extends any[] = any[], Item = Input[number]> = ExecutionIssue<
		'toFiltered:callback_failed',
		{ value: Input, item: Item, index: number, error: unknown },
		'operation'
	>
	export interface Options<Input extends any[] = any[]> extends StepOptions<Issue<Input>> {
		readonly thisArg?: any
	}
}

type Meta = DefineStepMethodMeta<{
	Name: 'toFiltered'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: any[] & { filter: (...params: any[]) => any } }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * Returns elements accepted by the predicate. The optional `thisArg` and
	 * message are supplied through the second options object. Predicate
	 * exceptions emit `toFiltered:callback_failed` with item and index.
	 */
	toFiltered:
		| DefineStepMethod<
			Meta,
			this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
				? InferOutput<This> extends infer Input extends any[]
					? <Narrowed extends Input[number]>(
							predicate: (item: Input[number], index: number, value: Input) => item is Narrowed,
							options?: Internal.Options<Input>,
						) => Next<{ output: Narrowed[], issue: Internal.Issue<Input> }, This>
					: never
				: never
		>
		| DefineStepMethod<
			Meta,
			this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
				? InferOutput<This> extends infer Input extends any[]
					? (
							predicate: (item: Input[number], index: number, value: Input) => unknown,
							options?: Internal.Options<Input>,
						) => Next<{ output: Input[number][], issue: Internal.Issue<Input> }, This>
					: never
				: never
		>
}

class FilterCallbackError {
	constructor(
		readonly item: unknown,
		readonly index: number,
		readonly error: unknown,
	) { }
}

/* @__NO_SIDE_EFFECTS__ */
export const toFiltered = implStepPlugin<PluginDef>({
	toFiltered: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [predicate, options],
	}) => {
		addSuccessStep((value) => {
			try {
				return success(value.filter((item: unknown, index: number, array: unknown[]) => {
					try {
						return predicate.call(options?.thisArg, item, index, array)
					}
					catch (error) {
						throw new FilterCallbackError(item, index, error)
					}
				}))
			}
			catch (error) {
				if (!(error instanceof FilterCallbackError))
					throw error
				return failure(createIssue({
					code: 'toFiltered:callback_failed',
					category: 'operation',
					payload: { value, item: error.item, index: error.index, error: error.error },
					customMessage: options?.message,
					defaultMessage: 'Filter callback failed.',
				}))
			}
		})
	},
})
