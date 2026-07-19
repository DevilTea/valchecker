import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue<Input extends Map<any, any> = Map<any, any>> = ExecutionIssue<
		'toMappedValues:callback_failed',
		{
			value: Input
			key: Input extends Map<infer Key, any> ? Key : never
			entryValue: Input extends Map<any, infer EntryValue> ? EntryValue : never
			index: number
			error: unknown
		},
		'operation'
	>
	export interface Options<Input extends Map<any, any>> extends StepOptions<Issue<Input>> {
		readonly thisArg?: any
	}
}

type Meta = DefineStepMethodMeta<{
	Name: 'toMappedValues'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: Map<any, any> }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * Maps Map values while preserving keys and insertion order. Mapper return
	 * values are stored directly; returned promises are not awaited.
	 *
	 * @issues `toMappedValues:callback_failed`
	 */
	toMappedValues: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? InferOutput<This> extends infer Input extends Map<any, any>
				? <Mapped>(
						mapper: (
							entryValue: Input extends Map<any, infer EntryValue> ? EntryValue : never,
							key: Input extends Map<infer Key, any> ? Key : never,
							index: number,
							value: Input,
						) => Mapped,
						options?: Internal.Options<Input>,
					) => Next<{
						output: Map<Input extends Map<infer Key, any> ? Key : never, Mapped>
						issue: Internal.Issue<Input>
					}, This>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const toMappedValues = implStepPlugin<PluginDef>({
	toMappedValues: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [mapper, options],
	}) => {
		addSuccessStep((value) => {
			const entries = [...value.entries()]
			const output = new Map<unknown, unknown>()
			for (let index = 0; index < entries.length; index++) {
				const [key, entryValue] = entries[index]!
				let mappedValue: unknown
				try {
					mappedValue = mapper.call(options?.thisArg, entryValue, key, index, value)
				}
				catch (error) {
					return failure(createIssue({
						code: 'toMappedValues:callback_failed',
						category: 'operation',
						payload: { value, key, entryValue, index, error },
						customMessage: options?.message,
						defaultMessage: 'Map value callback failed.',
					}))
				}
				output.set(key, mappedValue)
			}
			return success(output)
		})
	},
})
