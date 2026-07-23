import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, Next, StructuralStepOptions, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'
import { isPromiseLike } from '../../shared'

const nativeSetValues = Set.prototype.values

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
	 * ### Description:
	 * Validates and transforms every item of a `Set` in insertion order.
	 * Transformed items must remain unique. Traversal stops after the first
	 * recoverable issue unless `collectAllIssues` is enabled.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, set, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [set, string] })
	 * const schema = v.set(v.string())
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'set:expected_set'`: The value is not a `Set`.
	 * - `'set:duplicate_transformed_item'`: Two items produced the same transformed value.
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

interface FirstItemMetadata {
	firstIndex: number
	firstItem: unknown
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

		// Deliberately duplicated per-file: V8 inlines this local closure but not a shared cross-module helper. See architecture.md (extraction measured -12%/-13% on the failure hot path, 2026-07-22).
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
			firstItem: unknown,
			firstIndex: number,
			item: unknown,
			index: number,
			transformedItem: unknown,
		) => createIssue({
			code: 'set:duplicate_transformed_item',
			payload: {
				value,
				firstItem,
				item,
				transformedItem,
				firstIndex,
				index,
			},
			path: [index],
			customMessage: options?.message,
			defaultMessage: 'Expected transformed Set items to be unique.',
		})

		// Iteration is over the live native Set iterator; items are consumed
		// lazily so a first-issue short-circuit never pays for the tail. Items
		// are not snapshotted before child execution, so a child step that
		// mutates the input Set during validation observes the same live
		// iteration semantics as the underlying Set iterator.
		const continueAsync = async (
			value: Set<unknown>,
			iterator: Iterator<unknown>,
			firstResult: PromiseLike<ExecutionResult>,
			firstItem: unknown,
			output: Set<unknown> | undefined,
			firstItemMeta: Map<unknown, FirstItemMetadata> | undefined,
			issues: AnyExecutionIssue[] | undefined,
			index: number,
		) => {
			const result = await firstResult
			if (isFailure(result)) {
				const appended = appendChildIssues(result, index, issues)
				issues = appended.issues
				if (appended.hasInternal || !collectAllIssues)
					return failure(issues)
			}
			else {
				const transformedItem = result.value
				if (output?.has(transformedItem)) {
					const first = firstItemMeta!.get(transformedItem)
					if (first == null)
						throw new Error('Missing transformed Set item metadata.')
					const target = issues ??= []
					target.push(createDuplicateIssue(value, first.firstItem, first.firstIndex, firstItem, index, transformedItem))
					if (!collectAllIssues)
						return failure(target)
				}
				else {
					output ??= new Set()
					firstItemMeta ??= new Map()
					output.add(transformedItem)
					firstItemMeta.set(transformedItem, { firstIndex: index, firstItem })
				}
			}
			index++

			for (let step = iterator.next(); !step.done; step = iterator.next()) {
				const item = step.value
				const itemResult = await execute(item)
				if (isFailure(itemResult)) {
					const appended = appendChildIssues(itemResult, index, issues)
					issues = appended.issues
					if (appended.hasInternal || !collectAllIssues)
						return failure(issues)
					index++
					continue
				}

				const transformedItem = itemResult.value
				if (output?.has(transformedItem)) {
					const first = firstItemMeta!.get(transformedItem)
					if (first == null)
						throw new Error('Missing transformed Set item metadata.')
					const target = issues ??= []
					target.push(createDuplicateIssue(value, first.firstItem, first.firstIndex, item, index, transformedItem))
					if (!collectAllIssues)
						return failure(target)
				}
				else {
					output ??= new Set()
					firstItemMeta ??= new Map()
					output.add(transformedItem)
					firstItemMeta.set(transformedItem, { firstIndex: index, firstItem: item })
				}
				index++
			}
			return issues == null ? success(output ?? new Set()) : failure(issues)
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

			const iterator = nativeSetValues.call(value) as Iterator<unknown>

			if (childIsSynchronous) {
				// Lazy buffer of consumed identity items: while every item maps to
				// itself the output equals the input, so items are only buffered
				// (not added to a Set). The output Set is materialized the first
				// time a transform differs, seeded from the buffer so duplicate
				// detection sees earlier items. A first-issue short-circuit
				// therefore buffers only up to the failing item.
				let buffer: unknown[] | undefined
				let bufferCount = 0
				let output: Set<unknown> | undefined
				let firstItemMeta: Map<unknown, FirstItemMetadata> | undefined
				let issues: AnyExecutionIssue[] | undefined
				let index = 0

				for (let step = iterator.next(); !step.done; step = iterator.next()) {
					const item = step.value
					const result = execute(item) as ExecutionResult
					if (isFailure(result)) {
						const appended = appendChildIssues(result, index, issues)
						issues = appended.issues
						if (appended.hasInternal || !collectAllIssues)
							return failure(issues)
						index++
						continue
					}

					const transformedItem = result.value
					if (output == null) {
						// eslint-disable-next-line no-self-compare -- intentional NaN self-comparison implementing SameValueZero identity (x !== x is true only for NaN)
						const isIdentity = transformedItem === item || (transformedItem !== transformedItem && item !== item)
						if (isIdentity) {
							buffer ??= []
							buffer[bufferCount] = item
							bufferCount++
							index++
							continue
						}
						output = new Set()
						firstItemMeta = new Map()
						for (let bufferIndex = 0; bufferIndex < bufferCount; bufferIndex++) {
							const bufferedItem = buffer![bufferIndex]
							output.add(bufferedItem)
							firstItemMeta.set(bufferedItem, { firstIndex: bufferIndex, firstItem: bufferedItem })
						}
					}

					if (output.has(transformedItem)) {
						const first = firstItemMeta!.get(transformedItem)
						if (first == null)
							throw new Error('Missing transformed Set item metadata.')
						const target = issues ??= []
						target.push(createDuplicateIssue(value, first.firstItem, first.firstIndex, item, index, transformedItem))
						if (!collectAllIssues)
							return failure(target)
					}
					else {
						output.add(transformedItem)
						firstItemMeta!.set(transformedItem, { firstIndex: index, firstItem: item })
					}
					index++
				}

				if (issues != null)
					return failure(issues)
				if (output != null)
					return success(output)

				output = new Set()
				for (let bufferIndex = 0; bufferIndex < bufferCount; bufferIndex++)
					output.add(buffer![bufferIndex])
				return success(output)
			}

			let output: Set<unknown> | undefined
			let firstItemMeta: Map<unknown, FirstItemMetadata> | undefined
			let issues: AnyExecutionIssue[] | undefined
			let index = 0

			for (let step = iterator.next(); !step.done; step = iterator.next()) {
				const item = step.value
				const result = execute(item)
				if (isPromiseLike(result))
					return continueAsync(value, iterator, result, item, output, firstItemMeta, issues, index)

				const syncResult = result as ExecutionResult
				if (isFailure(syncResult)) {
					const appended = appendChildIssues(syncResult, index, issues)
					issues = appended.issues
					if (appended.hasInternal || !collectAllIssues)
						return failure(issues)
					index++
					continue
				}

				const transformedItem = syncResult.value
				if (output?.has(transformedItem)) {
					const first = firstItemMeta!.get(transformedItem)
					if (first == null)
						throw new Error('Missing transformed Set item metadata.')
					const target = issues ??= []
					target.push(createDuplicateIssue(value, first.firstItem, first.firstIndex, item, index, transformedItem))
					if (!collectAllIssues)
						return failure(target)
				}
				else {
					output ??= new Set()
					firstItemMeta ??= new Map()
					output.add(transformedItem)
					firstItemMeta.set(transformedItem, { firstIndex: index, firstItem: item })
				}
				index++
			}

			return issues == null ? success(output ?? new Set()) : failure(issues)
		}, operationMode)
	},
})
