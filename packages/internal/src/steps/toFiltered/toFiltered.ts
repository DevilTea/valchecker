import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'
import { CallbackErrorSentinel, runWithCallbackErrorSentinel } from '../callbackErrorSentinel'

declare namespace Internal {
	export type Issue<Input = any, Item = any> = ExecutionIssue<
		'toFiltered:callback_failed',
		{ value: Input, item: Item, index: number, error: unknown },
		'operation'
	>
	export interface Options<Input = any, Item = any> extends StepOptions<Issue<Input, Item>> {
		readonly thisArg?: any
	}
}

type Meta = DefineStepMethodMeta<{
	Name: 'toFiltered'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: any[] | Set<any> }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Returns array or Set items accepted by the predicate. Predicate return
	 * values are consumed synchronously; returned promises are ordinary truthy
	 * values rather than awaited work.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { array, createValchecker, number, toFiltered } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [array, number, toFiltered] })
	 * const schema = v.array(v.number()).toFiltered(item => item > 0)
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'toFiltered:callback_failed'`: The predicate threw.
	 */
	toFiltered:
		| DefineStepMethod<
			Meta,
			this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
				? InferOutput<This> extends infer Input extends any[]
					? <Narrowed extends Input[number]>(
							predicate: (item: Input[number], index: number, value: Input) => item is Narrowed,
							options?: Internal.Options<Input, Input[number]>,
						) => Next<{ output: Narrowed[], issue: Internal.Issue<Input, Input[number]> }, This>
					: never
				: never
		>
		| DefineStepMethod<
			Meta,
			this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
				? InferOutput<This> extends infer Input extends any[]
					? (
							predicate: (item: Input[number], index: number, value: Input) => unknown,
							options?: Internal.Options<Input, Input[number]>,
						) => Next<{ output: Input[number][], issue: Internal.Issue<Input, Input[number]> }, This>
					: never
				: never
		>
		| DefineStepMethod<
			Meta,
			this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
				? InferOutput<This> extends infer Input extends Set<any>
					? <Narrowed extends Input extends Set<infer Item> ? Item : never>(
							predicate: (
								item: Input extends Set<infer Item> ? Item : never,
								index: number,
								value: Input,
							) => item is Narrowed,
							options?: Internal.Options<Input, Input extends Set<infer Item> ? Item : never>,
						) => Next<{
							output: Set<Narrowed>
							issue: Internal.Issue<Input, Input extends Set<infer Item> ? Item : never>
						}, This>
					: never
				: never
		>
		| DefineStepMethod<
			Meta,
			this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
				? InferOutput<This> extends infer Input extends Set<any>
					? (
							predicate: (
								item: Input extends Set<infer Item> ? Item : never,
								index: number,
								value: Input,
							) => unknown,
							options?: Internal.Options<Input, Input extends Set<infer Item> ? Item : never>,
						) => Next<{
							output: Set<Input extends Set<infer Item> ? Item : never>
							issue: Internal.Issue<Input, Input extends Set<infer Item> ? Item : never>
						}, This>
					: never
				: never
		>
}

/* @__NO_SIDE_EFFECTS__ */
export const toFiltered = implStepPlugin<PluginDef>({
	toFiltered: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [predicate, options],
	}) => {
		addSuccessStep((value) => {
			if (Array.isArray(value)) {
				return runWithCallbackErrorSentinel(
					() => success(value.filter((item: unknown, index: number, array: unknown[]) => {
						try {
							return predicate.call(options?.thisArg, item, index, array)
						}
						catch (error) {
							throw new CallbackErrorSentinel({ item, index }, error)
						}
					})),
					(context: { item: unknown, index: number }, error) => failure(createIssue({
						code: 'toFiltered:callback_failed',
						category: 'operation',
						payload: { value, item: context.item, index: context.index, error },
						customMessage: options?.message,
						defaultMessage: 'Filter callback failed.',
					})),
				)
			}

			const items = [...value]
			const output = new Set<unknown>()
			for (let index = 0; index < items.length; index++) {
				const item = items[index]
				let included: unknown
				try {
					included = predicate.call(options?.thisArg, item, index, value)
				}
				catch (error) {
					return failure(createIssue({
						code: 'toFiltered:callback_failed',
						category: 'operation',
						payload: { value, item, index, error },
						customMessage: options?.message,
						defaultMessage: 'Filter callback failed.',
					}))
				}
				if (included)
					output.add(item)
			}
			return success(output)
		})
	},
}, 'sync')
