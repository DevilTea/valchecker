import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'
import { CallbackErrorSentinel, runWithCallbackErrorSentinel } from '../callbackErrorSentinel'

declare namespace Internal {
	export type CallbackIssue<Input = any, Item = any> = ExecutionIssue<
		'toMapped:callback_failed',
		{ value: Input, item: Item, index: number, error: unknown },
		'operation'
	>
	export type DuplicateMappedItemIssue<Input extends Set<any> = Set<any>, Mapped = unknown> = ExecutionIssue<
		'toMapped:duplicate_mapped_item',
		{
			value: Input
			firstItem: Input extends Set<infer Item> ? Item : never
			item: Input extends Set<infer Item> ? Item : never
			mappedItem: Mapped
			firstIndex: number
			index: number
		}
	>
	export interface Options<Issue extends AnyExecutionIssue = AnyExecutionIssue> extends StepOptions<Issue> {
		readonly thisArg?: any
	}
}

type Meta = DefineStepMethodMeta<{
	Name: 'toMapped'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: any[] | Set<any> }>
	SelfIssue: Internal.CallbackIssue | Internal.DuplicateMappedItemIssue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Maps every item of an array or `Set`, preserving order. Mapper return
	 * values are stored directly; returned promises are not awaited. For a `Set`
	 * input the mapped items must remain unique.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { array, createValchecker, number, toMapped } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [array, number, toMapped] })
	 * const schema = v.array(v.number()).toMapped(item => item * 2)
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'toMapped:callback_failed'`: The mapper threw.
	 * - `'toMapped:duplicate_mapped_item'`: Two `Set` items produced the same mapped value.
	 */
	toMapped:
		| DefineStepMethod<
			Meta,
			this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
				? InferOutput<This> extends infer Input extends any[]
					? <Mapped>(
							mapper: (item: Input[number], index: number, value: Input) => Mapped,
							options?: Internal.Options<Internal.CallbackIssue<Input, Input[number]>>,
						) => Next<{
							output: Mapped[]
							issue: Internal.CallbackIssue<Input, Input[number]>
						}, This>
					: never
				: never
		>
		| DefineStepMethod<
			Meta,
			this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
				? InferOutput<This> extends infer Input extends Set<any>
					? <Mapped>(
							mapper: (
								item: Input extends Set<infer Item> ? Item : never,
								index: number,
								value: Input,
							) => Mapped,
							options?: Internal.Options<
								| Internal.CallbackIssue<Input, Input extends Set<infer Item> ? Item : never>
								| Internal.DuplicateMappedItemIssue<Input, Mapped>
							>,
						) => Next<{
							output: Set<Mapped>
							issue:
								| Internal.CallbackIssue<Input, Input extends Set<infer Item> ? Item : never>
								| Internal.DuplicateMappedItemIssue<Input, Mapped>
						}, This>
					: never
				: never
		>
}

/* @__NO_SIDE_EFFECTS__ */
export const toMapped = implStepPlugin<PluginDef>({
	toMapped: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [mapper, options],
	}) => {
		addSuccessStep((value) => {
			if (Array.isArray(value)) {
				return runWithCallbackErrorSentinel(
					() => success(value.map((item: unknown, index: number, array: unknown[]) => {
						try {
							return mapper.call(options?.thisArg, item, index, array)
						}
						catch (error) {
							throw new CallbackErrorSentinel({ item, index }, error)
						}
					})),
					(context: { item: unknown, index: number }, error) => failure(createIssue({
						code: 'toMapped:callback_failed',
						category: 'operation',
						payload: { value, item: context.item, index: context.index, error },
						customMessage: options?.message,
						defaultMessage: 'Map callback failed.',
					})),
				)
			}

			const items = [...value]
			const output = new Set<unknown>()
			const firstItems = new Map<unknown, { item: unknown, index: number }>()
			for (let index = 0; index < items.length; index++) {
				const item = items[index]
				let mappedItem: unknown
				try {
					mappedItem = mapper.call(options?.thisArg, item, index, value)
				}
				catch (error) {
					return failure(createIssue({
						code: 'toMapped:callback_failed',
						category: 'operation',
						payload: { value, item, index, error },
						customMessage: options?.message,
						defaultMessage: 'Map callback failed.',
					}))
				}

				if (output.has(mappedItem)) {
					const first = firstItems.get(mappedItem)!
					return failure(createIssue({
						code: 'toMapped:duplicate_mapped_item',
						payload: {
							value,
							firstItem: first.item,
							item,
							mappedItem,
							firstIndex: first.index,
							index,
						},
						// The impl-level `options` type collapses the Set overload's
						// message union down to the callback issue; the runtime value is
						// the caller's handler for the full union, so retarget it here.
						customMessage: options?.message as StepOptions<Internal.DuplicateMappedItemIssue>['message'],
						defaultMessage: 'Expected mapped Set items to be unique.',
					}))
				}

				output.add(mappedItem)
				firstItems.set(mappedItem, { item, index })
			}
			return success(output)
		})
	},
}, 'sync')
