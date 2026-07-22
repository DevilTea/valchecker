import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, Next, StructuralStepOptions, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'
import { getExecutionEffects, withExecutionEffects } from '../../core/execution-effects'
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

interface SetExecutionEffectsMetadata {
	readonly itemIsDirectIdentity: boolean
}

/* @__NO_SIDE_EFFECTS__ */
export const set = /* @__PURE__ */ withExecutionEffects(implStepPlugin<PluginDef>({
	set: ({
		utils: { addSuccessStep, success, createIssue, failure, isFailure, prependIssuePath },
		params: [itemSchema, options],
	}) => {
		const execute = itemSchema['~execute']
		const operationMode = itemSchema['~core']?.operationMode === 'sync' ? 'sync' : 'maybe-async'
		const childIsSynchronous = operationMode === 'sync'
		const collectAllIssues = options?.collectAllIssues === true
		const itemEffects = getExecutionEffects(itemSchema)
		const itemIsDirectIdentity = childIsSynchronous
			&& itemEffects.identity === 'identity-preserving'
			&& itemEffects.parentTraversal === 'direct-safe'

		const appendChildIssues = (
			result: ExecutionResult,
			index: number,
			issues: AnyExecutionIssue[] | undefined,
		): { issues: AnyExecutionIssue[], hasInternal: boolean } => {
			let hasInternal = false
			const target = issues ?? []
			if (isFailure(result)) {
				for (const issue of result.issues) {
					if (issue.category === 'internal')
						hasInternal = true
					target.push(prependIssuePath(issue, [index], options?.message))
				}
			}
			return { issues: target, hasInternal }
		}

		const createDuplicateIssue = (
			value: Set<unknown>,
			items: unknown[],
			firstIndex: number,
			item: unknown,
			index: number,
			transformedItem: unknown,
		) => createIssue({
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
		})

		const continueAsync = async (
			value: Set<unknown>,
			items: unknown[],
			startIndex: number,
			firstResult: PromiseLike<ExecutionResult>,
			output: Set<unknown> | undefined,
			firstItemIndex: Map<unknown, number> | undefined,
			issues: AnyExecutionIssue[] | undefined,
		): Promise<ExecutionResult> => {
			for (let index = startIndex; index < items.length; index++) {
				const item = items[index]
				const result = index === startIndex ? await firstResult : await execute(item)
				if (isFailure(result)) {
					const appended = appendChildIssues(result, index, issues)
					issues = appended.issues
					if (appended.hasInternal || !collectAllIssues)
						return failure(issues)
					continue
				}

				const transformedItem = result.value
				if (output?.has(transformedItem)) {
					const firstIndex = firstItemIndex!.get(transformedItem)
					if (firstIndex == null)
						throw new Error('Missing transformed Set item metadata.')
					const target = issues ??= []
					target.push(createDuplicateIssue(value, items, firstIndex, item, index, transformedItem))
					if (!collectAllIssues)
						return failure(target)
				}
				else {
					output ??= new Set()
					firstItemIndex ??= new Map()
					output.add(transformedItem)
					firstItemIndex.set(transformedItem, index)
				}
			}
			return issues == null ? success(output ?? new Set()) : failure(issues)
		}

		const executeSnapshot = (value: unknown) => {
			if (!(value instanceof Set)) {
				return failure(createIssue({
					code: 'set:expected_set',
					payload: { value },
					customMessage: options?.message,
					defaultMessage: 'Expected a Set.',
				}))
			}

			const items = [...value.values()]
			let output: Set<unknown> | undefined
			let firstItemIndex: Map<unknown, number> | undefined
			let issues: AnyExecutionIssue[] | undefined

			for (let index = 0; index < items.length; index++) {
				const item = items[index]
				const result = execute(item)
				if (!childIsSynchronous && isPromiseLike(result))
					return continueAsync(value, items, index, result, output, firstItemIndex, issues)

				const syncResult = result as ExecutionResult
				if (isFailure(syncResult)) {
					const appended = appendChildIssues(syncResult, index, issues)
					issues = appended.issues
					if (appended.hasInternal || !collectAllIssues)
						return failure(issues)
					continue
				}

				const transformedItem = syncResult.value
				if (output?.has(transformedItem)) {
					const firstIndex = firstItemIndex!.get(transformedItem)
					if (firstIndex == null)
						throw new Error('Missing transformed Set item metadata.')
					const target = issues ??= []
					target.push(createDuplicateIssue(value, items, firstIndex, item, index, transformedItem))
					if (!collectAllIssues)
						return failure(target)
				}
				else {
					output ??= new Set()
					firstItemIndex ??= new Map()
					output.add(transformedItem)
					firstItemIndex.set(transformedItem, index)
				}
			}

			return issues == null ? success(output ?? new Set()) : failure(issues)
		}

		const executeDirectIdentity = (value: unknown) => {
			if (!(value instanceof Set)) {
				return failure(createIssue({
					code: 'set:expected_set',
					payload: { value },
					customMessage: options?.message,
					defaultMessage: 'Expected a Set.',
				}))
			}

			let output: Set<unknown> | undefined
			let issues: AnyExecutionIssue[] | undefined
			let index = 0
			const iterator = Set.prototype.values.call(value) as IterableIterator<unknown>

			for (let next = iterator.next(); !next.done; next = iterator.next()) {
				const item = next.value
				const result = execute(item) as ExecutionResult
				if (isFailure(result)) {
					const appended = appendChildIssues(result, index, issues)
					issues = appended.issues
					if (appended.hasInternal || !collectAllIssues)
						return failure(issues)
				}
				else {
					output ??= new Set()
					output.add(item)
				}
				index++
			}

			return issues == null ? success(output ?? new Set()) : failure(issues)
		}

		addSuccessStep(itemIsDirectIdentity ? executeDirectIdentity : executeSnapshot, operationMode)
		return { itemIsDirectIdentity }
	},
}), {
	set: (previous, _params, stepMetadata) => {
		const { itemIsDirectIdentity } = stepMetadata as SetExecutionEffectsMetadata
		return {
			identity: 'may-transform',
			parentTraversal: previous.parentTraversal === 'direct-safe' && itemIsDirectIdentity
				? 'direct-safe'
				: 'snapshot-required',
			structuralOutput: null,
		}
	},
})
