import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue<Input extends any[] = any[], Item = Input[number]> = ExecutionIssue<
		'toMapped:callback_failed',
		{ value: Input, item: Item, index: number, error: unknown },
		'operation'
	>
	export interface Options<Input extends any[] = any[]> extends StepOptions<Issue<Input>> {
		readonly thisArg?: any
	}
}

type Meta = DefineStepMethodMeta<{
	Name: 'toMapped'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: any[] & { map: (...params: any[]) => any } }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	toMapped: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? InferOutput<This> extends infer Input extends any[]
				? <Mapped>(
						mapper: (item: Input[number], index: number, value: Input) => Mapped,
						options?: Internal.Options<Input>,
					) => Next<{ output: Mapped[], issue: Internal.Issue<Input> }, This>
				: never
			: never
	>
}

class MapCallbackError {
	constructor(
		readonly item: unknown,
		readonly index: number,
		readonly error: unknown,
	) { }
}

/* @__NO_SIDE_EFFECTS__ */
export const toMapped = implStepPlugin<PluginDef>({
	toMapped: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [mapper, options],
	}) => {
		addSuccessStep((value) => {
			try {
				return success(value.map((item: unknown, index: number, array: unknown[]) => {
					try {
						return mapper.call(options?.thisArg, item, index, array as any)
					}
					catch (error) {
						throw new MapCallbackError(item, index, error)
					}
				}))
			}
			catch (error) {
				if (!(error instanceof MapCallbackError))
					throw error
				return failure(createIssue({
					code: 'toMapped:callback_failed',
					category: 'operation',
					payload: { value, item: error.item, index: error.index, error: error.error },
					customMessage: options?.message,
					defaultMessage: 'Map callback failed.',
				}))
			}
		})
	},
})
