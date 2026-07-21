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

		const processResult = (
			value: Set<unknown>,
			items: unknown[],
			output: Set<unknown>,
			firstItemIndex: Map<unknown, number>,
			result: ExecutionResult,
			item: unknown,
			index: number,
			issues: AnyExecutionIssue[] | undefined,
		): { issues: AnyExecutionIssue[] | undefined, stop: boolean } => {
			if (isFailure(result)) {
				let hasInternal = false
				const target = issues ?? []
				for (const issue of result.issues) {
					if (issue.category === 'internal')
						hasInternal = true
					target.push(prependIssuePath(issue, [index], options?.message))
				}
				return { issues: target, stop: hasInternal || !collectAllIssues }
			}

			const transformedItem = result.value
			if (output.has(transformedItem)) {
				const firstIndex = firstItemIndex.get(transformedItem)
				if (firstIndex == null)
					throw new Error('Missing transformed Set item metadata.')
				const target = issues ?? []
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
				return { issues: target, stop: !collectAllIssues }
			}

			output.add(transformedItem)
			firstItemIndex.set(transformedItem, index)
			return { issues, stop: false }
		}

		const continueAsync = async (
			value: Set<unknown>,
			items: unknown[],
			startIndex: number,
			firstResult: PromiseLike<ExecutionResult>,
			output: Set<unknown>,
			firstItemIndex: Map<unknown, number>,
			issues: AnyExecutionIssue[] | undefined,
		): Promise<ExecutionResult> => {
			for (let index = startIndex; index < items.length; index++) {
				const item = items[index]
				const result = index === startIndex ? await firstResult : await execute(item)
				const processed = processResult(value, items, output, firstItemIndex, result, item, index, issues)
				issues = processed.issues
				if (processed.stop)
					return failure(issues!)
			}
			return issues == null ? success(output) : failure(issues)
		}

		addSuccessStep((value) => {
			if (!(value instanceof Set)) {
				return failure(createIssue({
					code: 'set:expected_set',
					payload: { value },
					customMessage: options?.message,
					defaultMessage: 'Expected a Set.',
				}))
			}

			const items = [...value.values()]
			const output = new Set<unknown>()
			const firstItemIndex = new Map<unknown, number>()
			let issues: AnyExecutionIssue[] | undefined

			for (let index = 0; index < items.length; index++) {
				const item = items[index]
				const result = execute(item)
				if (!childIsSynchronous && isPromiseLike(result))
					return continueAsync(value, items, index, result, output, firstItemIndex, issues)

				const processed = processResult(
					value,
					items,
					output,
					firstItemIndex,
					result as ExecutionResult,
					item,
					index,
					issues,
				)
				issues = processed.issues
				if (processed.stop)
					return failure(issues!)
			}

			return issues == null ? success(output) : failure(issues)
		}, operationMode)
	},
})
