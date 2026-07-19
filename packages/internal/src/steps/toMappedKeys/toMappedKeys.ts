import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type CallbackIssue<Input extends Map<any, any> = Map<any, any>> = ExecutionIssue<
		'toMappedKeys:callback_failed',
		{
			value: Input
			key: Input extends Map<infer Key, any> ? Key : never
			entryValue: Input extends Map<any, infer EntryValue> ? EntryValue : never
			index: number
			error: unknown
		},
		'operation'
	>
	export type DuplicateMappedKeyIssue<
		Input extends Map<any, any> = Map<any, any>,
		MappedKey = unknown,
	> = ExecutionIssue<
		'toMappedKeys:duplicate_mapped_key',
		{
			value: Input
			firstSourceKey: Input extends Map<infer Key, any> ? Key : never
			sourceKey: Input extends Map<infer Key, any> ? Key : never
			mappedKey: MappedKey
			firstIndex: number
			index: number
		}
	>
	export interface Options<Input extends Map<any, any>, MappedKey> extends StepOptions<
		CallbackIssue<Input> | DuplicateMappedKeyIssue<Input, MappedKey>
	> {
		readonly thisArg?: any
	}
}

type Meta = DefineStepMethodMeta<{
	Name: 'toMappedKeys'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: Map<any, any> }>
	SelfIssue: Internal.CallbackIssue | Internal.DuplicateMappedKeyIssue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * Maps Map keys while preserving values and insertion order. Mapped keys
	 * must remain unique under native Map SameValueZero semantics.
	 *
	 * @issues `toMappedKeys:callback_failed`, `toMappedKeys:duplicate_mapped_key`
	 */
	toMappedKeys: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? InferOutput<This> extends infer Input extends Map<any, any>
				? <MappedKey>(
						mapper: (
							key: Input extends Map<infer Key, any> ? Key : never,
							entryValue: Input extends Map<any, infer EntryValue> ? EntryValue : never,
							index: number,
							value: Input,
						) => MappedKey,
						options?: Internal.Options<Input, MappedKey>,
					) => Next<{
						output: Map<MappedKey, Input extends Map<any, infer EntryValue> ? EntryValue : never>
						issue: Internal.CallbackIssue<Input> | Internal.DuplicateMappedKeyIssue<Input, MappedKey>
					}, This>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const toMappedKeys = implStepPlugin<PluginDef>({
	toMappedKeys: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [mapper, options],
	}) => {
		addSuccessStep((value) => {
			const entries = [...value.entries()]
			const output = new Map<unknown, unknown>()
			const firstKeys = new Map<unknown, { sourceKey: unknown, index: number }>()
			for (let index = 0; index < entries.length; index++) {
				const [key, entryValue] = entries[index]!
				let mappedKey: unknown
				try {
					mappedKey = mapper.call(options?.thisArg, key, entryValue, index, value)
				}
				catch (error) {
					return failure(createIssue({
						code: 'toMappedKeys:callback_failed',
						category: 'operation',
						payload: { value, key, entryValue, index, error },
						customMessage: options?.message,
						defaultMessage: 'Map key callback failed.',
					}))
				}

				if (output.has(mappedKey)) {
					const first = firstKeys.get(mappedKey)
					if (first == null)
						throw new Error('Missing mapped Map key metadata.')
					return failure(createIssue({
						code: 'toMappedKeys:duplicate_mapped_key',
						payload: {
							value,
							firstSourceKey: first.sourceKey,
							sourceKey: key,
							mappedKey,
							firstIndex: first.index,
							index,
						},
						customMessage: options?.message,
						defaultMessage: 'Expected mapped Map keys to be unique.',
					}))
				}

				output.set(mappedKey, entryValue)
				firstKeys.set(mappedKey, { sourceKey: key, index })
			}
			return success(output)
		})
	},
})
