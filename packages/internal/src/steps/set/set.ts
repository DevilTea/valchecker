import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, Next, StructuralStepOptions, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'
import { isPromiseLike } from '../../shared'

declare namespace Internal {
	export type OpMode<I extends Use<Valchecker>> = IsEqual<InferOperationMode<I>, 'sync'> extends true ? 'sync' : 'maybe-async'
	export type ExpectedIssue = ExecutionIssue<'set:expected_set', { value: unknown }>
	export type DuplicateTransformedItemIssue<I = unknown> = ExecutionIssue<
		'set:duplicate_transformed_item',
		{
			value: Set<unknown>
			firstItem: unknown
			item: unknown
			transformedItem: I
			firstIndex: number
			index: number
		}
	>
	export type Issue<I extends Use<Valchecker> = Use<Valchecker>>
		= ExpectedIssue | DuplicateTransformedItemIssue<InferOutput<I>> | InferIssue<I>
}

type Meta = DefineStepMethodMeta<{
	Name: 'set'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.ExpectedIssue | Internal.DuplicateTransformedItemIssue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * Validates and transforms every item of a `Set` in insertion order.
	 * Transformed items must remain unique. Traversal stops after the first
	 * recoverable issue unless `collectAllIssues` is enabled.
	 *
	 * @example `v.set(v.string())`
	 * @issues `set:expected_set`, `set:duplicate_transformed_item`
	 */
	set: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? IsExactlyAnyOrUnknown<InferOutput<This>> extends true
				? <I extends Use<Valchecker>>(
						item: I,
						options?: StructuralStepOptions<Internal.Issue<NoInfer<I>>>,
					) => Next<{
						operationMode: Internal.OpMode<I>
						output: Set<InferOutput<I>>
						issue: Internal.Issue<I>
					}, This>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const set = implStepPlugin<PluginDef>({
	set: ({
		utils: { addSuccessStep, success, createIssue, failure, isFailure, prependIssuePath },
		params: [itemSchema, options],
	}) => {
		const execute = itemSchema['~execute']
		const operationMode = itemSchema['~core']?.operationMode === 'sync' ? 'sync' : 'maybe-async'
		const childIsSynchronous = operationMode === 'sync'
		const collectAllIssues = options?.collectAllIssues === true

		const expectedSetFailure = (value: unknown) => failure(createIssue({
			code: 'set:expected_set',
			payload: { value },
			customMessage: options?.message,
			defaultMessage: 'Expected a Set.',
		}))

		const executeFirstIssue = (value: unknown) => {
			if (!(value instanceof Set))
				return expectedSetFailure(value)

			const items = [...value.values()]
			const output = new Set<unknown>()
			const firstItemIndex = new Map<unknown, number>()

			const processResult = (result: ExecutionResult, item: unknown, index: number): ExecutionResult | undefined => {
				if (isFailure(result)) {
					const issues: AnyExecutionIssue[] = []
					for (const issue of result.issues)
						issues.push(prependIssuePath(issue, [index], options?.message))
					return failure(issues)
				}

				const transformedItem = result.value
				if (output.has(transformedItem)) {
					const firstIndex = firstItemIndex.get(transformedItem)
					if (firstIndex == null)
						throw new Error('Missing transformed Set item metadata.')
					return failure(createIssue({
						code: 'set:duplicate_transformed_item',
						payload: {
							value,
							firstItem: items[firstIndex],
							item,
							transformedItem,
							firstIndex,
							index,
						},
						path: [index],
						customMessage: options?.message,
						defaultMessage: 'Expected transformed Set items to be unique.',
					}))
				}

				output.add(transformedItem)
				firstItemIndex.set(transformedItem, index)
				return undefined
			}

			const continueAsync = async (
				startIndex: number,
				firstResult: PromiseLike<ExecutionResult>,
			): Promise<ExecutionResult> => {
				for (let index = startIndex; index < items.length; index++) {
					const item = items[index]
					const result = index === startIndex ? await firstResult : await execute(item)
					const failureResult = processResult(result, item, index)
					if (failureResult != null)
						return failureResult
				}
				return success(output)
			}

			for (let index = 0; index < items.length; index++) {
				const item = items[index]
				const result = execute(item)
				if (!childIsSynchronous && isPromiseLike(result))
					return continueAsync(index, result)
				const failureResult = processResult(result as ExecutionResult, item, index)
				if (failureResult != null)
					return failureResult
			}
			return success(output)
		}

		const executeCollectAll = (value: unknown) => {
			if (!(value instanceof Set))
				return expectedSetFailure(value)

			const items = [...value.values()]
			const output = new Set<unknown>()
			const firstItemIndex = new Map<unknown, number>()
			let issues: AnyExecutionIssue[] | undefined

			const processResult = (result: ExecutionResult, item: unknown, index: number): boolean => {
				if (isFailure(result)) {
					let hasInternal = false
					const target = issues ??= []
					for (const issue of result.issues) {
						if (issue.category === 'internal')
							hasInternal = true
						target.push(prependIssuePath(issue, [index], options?.message))
					}
					return hasInternal
				}

				const transformedItem = result.value
				if (output.has(transformedItem)) {
					const firstIndex = firstItemIndex.get(transformedItem)
					if (firstIndex == null)
						throw new Error('Missing transformed Set item metadata.')
					const target = issues ??= []
					target.push(createIssue({
						code: 'set:duplicate_transformed_item',
						payload: {
							value,
							firstItem: items[firstIndex],
							item,
							transformedItem,
							firstIndex,
							index,
						},
						path: [index],
						customMessage: options?.message,
						defaultMessage: 'Expected transformed Set items to be unique.',
					}))
					return false
				}

				output.add(transformedItem)
				firstItemIndex.set(transformedItem, index)
				return false
			}

			const continueAsync = async (
				startIndex: number,
				firstResult: PromiseLike<ExecutionResult>,
			): Promise<ExecutionResult> => {
				for (let index = startIndex; index < items.length; index++) {
					const item = items[index]
					const result = index === startIndex ? await firstResult : await execute(item)
					if (processResult(result, item, index))
						return failure(issues!)
				}
				return issues == null ? success(output) : failure(issues)
			}

			for (let index = 0; index < items.length; index++) {
				const item = items[index]
				const result = execute(item)
				if (!childIsSynchronous && isPromiseLike(result))
					return continueAsync(index, result)
				if (processResult(result as ExecutionResult, item, index))
					return failure(issues!)
			}
			return issues == null ? success(output) : failure(issues)
		}

		addSuccessStep(collectAllIssues ? executeCollectAll : executeFirstIssue, operationMode)
	},
})