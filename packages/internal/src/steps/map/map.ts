import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, Next, OperationMode, StructuralStepOptions, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'
import { isPromiseLike } from '../../shared'

const nativeMapEntries = Map.prototype.entries

declare namespace Internal {
	type ResolveMode<M extends OperationMode> = IsEqual<M, 'sync'> extends true ? 'sync' : 'maybe-async'
	export type OpMode<K extends Use<Valchecker>, V extends Use<Valchecker>> = ResolveMode<InferOperationMode<K> | InferOperationMode<V>>
	export type ExpectedIssue = ExecutionIssue<'map:expected_map', { value: unknown }>
	export type DuplicateTransformedKeyIssue<K = unknown> = ExecutionIssue<
		'map:duplicate_transformed_key',
		{
			value: Map<unknown, unknown>
			firstSourceKey: unknown
			sourceKey: unknown
			transformedKey: K
			firstIndex: number
			index: number
		}
	>
	export type Issue<
		K extends Use<Valchecker> = Use<Valchecker>,
		V extends Use<Valchecker> = Use<Valchecker>,
	> = ExpectedIssue | DuplicateTransformedKeyIssue<InferOutput<K>> | InferIssue<K> | InferIssue<V>
	export interface Options<K extends Use<Valchecker>, V extends Use<Valchecker>> extends StructuralStepOptions<Issue<NoInfer<K>, NoInfer<V>>> {
		readonly key: K
		readonly value: V
	}
}

type Meta = DefineStepMethodMeta<{
	Name: 'map'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.ExpectedIssue | Internal.DuplicateTransformedKeyIssue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Validates and transforms every key and value of a `Map` in insertion order.
	 * The key and value schemas are supplied through one configuration object.
	 * Transformed keys must remain unique. Traversal stops after the first
	 * recoverable issue unless `collectAllIssues` is enabled.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, map, number, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [map, string, number] })
	 * const schema = v.map({ key: v.string(), value: v.number() })
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'map:expected_map'`: The value is not a `Map`.
	 * - `'map:duplicate_transformed_key'`: Two entries produced the same transformed key.
	 */
	map: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? IsExactlyAnyOrUnknown<InferOutput<This>> extends true
				? <K extends Use<Valchecker>, V extends Use<Valchecker>>(
						options: Internal.Options<K, V>,
					) => Next<{
						operationMode: Internal.OpMode<K, V>
						output: Map<InferOutput<K>, InferOutput<V>>
						issue: Internal.Issue<K, V>
					}, This>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const map = implStepPlugin<PluginDef>({
	map: ({
		utils: { addSuccessStep, success, createIssue, failure, isFailure, prependIssuePath },
		params: [options],
	}) => {
		const keyExecute = options.key['~execute']
		const valueExecute = options.value['~execute']
		const operationMode = options.key['~core']?.operationMode === 'sync'
			&& options.value['~core']?.operationMode === 'sync'
			? 'sync'
			: 'maybe-async'
		const childrenAreSynchronous = operationMode === 'sync'
		const collectAllIssues = options.collectAllIssues === true

		// Deliberately duplicated per-file: V8 inlines this local closure but not a shared cross-module helper. See architecture.md (extraction measured -12%/-13% on the failure hot path, 2026-07-22).
		const appendChildIssues = (
			result: ExecutionResult,
			path: PropertyKey[],
			issues: AnyExecutionIssue[] | undefined,
		): { issues: AnyExecutionIssue[], hasInternal: boolean } => {
			let hasInternal = false
			const target = issues ?? []
			if (isFailure(result)) {
				for (const issue of result.issues) {
					if (issue.category === 'internal')
						hasInternal = true
					target.push(prependIssuePath(issue, path, options.message))
				}
			}
			return { issues: target, hasInternal }
		}

		const createDuplicateIssue = (
			value: Map<unknown, unknown>,
			firstSourceKey: unknown,
			firstIndex: number,
			sourceKey: unknown,
			index: number,
			transformedKey: unknown,
		) => createIssue({
			code: 'map:duplicate_transformed_key',
			payload: {
				value,
				firstSourceKey,
				sourceKey,
				transformedKey,
				firstIndex,
				index,
			},
			path: [index, 'key'],
			customMessage: options.message,
			defaultMessage: 'Expected transformed Map keys to be unique.',
		})

		// Iteration is over the live native Map iterator; entries are consumed
		// lazily so a first-issue short-circuit never pays for the tail. Entries
		// are not snapshotted before child execution, so a child step that
		// mutates the input Map during validation observes the same live
		// iteration semantics as the underlying Map iterator.
		const continueAsync = async (
			value: Map<unknown, unknown>,
			iterator: Iterator<[unknown, unknown]>,
			pending: PromiseLike<ExecutionResult>,
			phase: 'key' | 'value',
			sourceKey: unknown,
			sourceValue: unknown,
			resolvedKey: ExecutionResult | undefined,
			output: Map<unknown, unknown> | undefined,
			firstKeyMeta: Map<unknown, { index: number, sourceKey: unknown }> | undefined,
			issues: AnyExecutionIssue[] | undefined,
			index: number,
		) => {
			const keyResult = phase === 'key' ? await pending : resolvedKey!
			const keyFailed = isFailure(keyResult)
			// When suspension happened on the value, the sync loop already
			// appended any key failure for this entry; re-appending would duplicate it.
			if (keyFailed && phase === 'key') {
				const appended = appendChildIssues(keyResult, [index, 'key'], issues)
				issues = appended.issues
				if (appended.hasInternal || !collectAllIssues)
					return failure(issues)
			}

			const valueResult = phase === 'value' ? await pending : await valueExecute(sourceValue)
			const valueFailed = isFailure(valueResult)
			if (valueFailed) {
				const appended = appendChildIssues(valueResult, [index, 'value'], issues)
				issues = appended.issues
				if (appended.hasInternal || !collectAllIssues)
					return failure(issues)
			}

			if (!keyFailed && !valueFailed) {
				const transformedKey = keyResult.value
				if (output?.has(transformedKey)) {
					const first = firstKeyMeta!.get(transformedKey)
					if (first == null)
						throw new Error('Missing transformed Map key metadata.')
					const target = issues ??= []
					target.push(createDuplicateIssue(value, first.sourceKey, first.index, sourceKey, index, transformedKey))
					if (!collectAllIssues)
						return failure(target)
				}
				else {
					output ??= new Map()
					firstKeyMeta ??= new Map()
					output.set(transformedKey, valueResult.value)
					firstKeyMeta.set(transformedKey, { index, sourceKey })
				}
			}
			index++

			for (let step = iterator.next(); !step.done; step = iterator.next()) {
				const currentKey = step.value[0]
				const currentValue = step.value[1]
				const currentKeyResult = await keyExecute(currentKey)
				const currentKeyFailed = isFailure(currentKeyResult)
				if (currentKeyFailed) {
					const appended = appendChildIssues(currentKeyResult, [index, 'key'], issues)
					issues = appended.issues
					if (appended.hasInternal || !collectAllIssues)
						return failure(issues)
				}

				const currentValueResult = await valueExecute(currentValue)
				const currentValueFailed = isFailure(currentValueResult)
				if (currentValueFailed) {
					const appended = appendChildIssues(currentValueResult, [index, 'value'], issues)
					issues = appended.issues
					if (appended.hasInternal || !collectAllIssues)
						return failure(issues)
				}

				if (!currentKeyFailed && !currentValueFailed) {
					const transformedKey = currentKeyResult.value
					if (output?.has(transformedKey)) {
						const first = firstKeyMeta!.get(transformedKey)
						if (first == null)
							throw new Error('Missing transformed Map key metadata.')
						const target = issues ??= []
						target.push(createDuplicateIssue(value, first.sourceKey, first.index, currentKey, index, transformedKey))
						if (!collectAllIssues)
							return failure(target)
					}
					else {
						output ??= new Map()
						firstKeyMeta ??= new Map()
						output.set(transformedKey, currentValueResult.value)
						firstKeyMeta.set(transformedKey, { index, sourceKey: currentKey })
					}
				}
				index++
			}

			return issues == null ? success(output ?? new Map()) : failure(issues)
		}

		addSuccessStep((value) => {
			if (!(value instanceof Map)) {
				return failure(createIssue({
					code: 'map:expected_map',
					payload: { value },
					customMessage: options.message,
					defaultMessage: 'Expected a Map.',
				}))
			}

			const iterator = nativeMapEntries.call(value) as Iterator<[unknown, unknown]>

			if (childrenAreSynchronous) {
				// Lazy buffer of consumed identity entries: while every key and
				// value maps to itself the output equals the input, so entries are
				// only buffered (not set into a Map). The output Map is
				// materialized the first time a transform differs, seeded from the
				// buffer so duplicate detection sees earlier keys. A first-issue
				// short-circuit therefore buffers only up to the failing entry.
				let bufferKeys: unknown[] | undefined
				let bufferValues: unknown[] | undefined
				let bufferCount = 0
				let output: Map<unknown, unknown> | undefined
				let firstKeyMeta: Map<unknown, { index: number, sourceKey: unknown }> | undefined
				let issues: AnyExecutionIssue[] | undefined
				let index = 0

				for (let step = iterator.next(); !step.done; step = iterator.next()) {
					const sourceKey = step.value[0]
					const sourceValue = step.value[1]
					const keyResult = keyExecute(sourceKey) as ExecutionResult
					const keyFailed = isFailure(keyResult)
					if (keyFailed) {
						const appended = appendChildIssues(keyResult, [index, 'key'], issues)
						issues = appended.issues
						if (appended.hasInternal || !collectAllIssues)
							return failure(issues)
					}

					const valueResult = valueExecute(sourceValue) as ExecutionResult
					const valueFailed = isFailure(valueResult)
					if (valueFailed) {
						const appended = appendChildIssues(valueResult, [index, 'value'], issues)
						issues = appended.issues
						if (appended.hasInternal || !collectAllIssues)
							return failure(issues)
					}

					if (!keyFailed && !valueFailed) {
						const transformedKey = keyResult.value
						const transformedValue = valueResult.value
						if (output == null) {
							const keyIsIdentity = transformedKey === sourceKey
								// eslint-disable-next-line no-self-compare -- intentional NaN self-comparison implementing SameValueZero identity (x !== x is true only for NaN)
								|| (transformedKey !== transformedKey && sourceKey !== sourceKey)
							if (keyIsIdentity && Object.is(transformedValue, sourceValue)) {
								bufferKeys ??= []
								bufferValues ??= []
								bufferKeys[bufferCount] = sourceKey
								bufferValues[bufferCount] = sourceValue
								bufferCount++
								index++
								continue
							}
							output = new Map()
							firstKeyMeta = new Map()
							for (let bufferIndex = 0; bufferIndex < bufferCount; bufferIndex++) {
								const bufferedKey = bufferKeys![bufferIndex]
								output.set(bufferedKey, bufferValues![bufferIndex])
								firstKeyMeta.set(bufferedKey, { index: bufferIndex, sourceKey: bufferedKey })
							}
						}

						if (output.has(transformedKey)) {
							const first = firstKeyMeta!.get(transformedKey)
							if (first == null)
								throw new Error('Missing transformed Map key metadata.')
							const target = issues ??= []
							target.push(createDuplicateIssue(value, first.sourceKey, first.index, sourceKey, index, transformedKey))
							if (!collectAllIssues)
								return failure(target)
						}
						else {
							output.set(transformedKey, transformedValue)
							firstKeyMeta!.set(transformedKey, { index, sourceKey })
						}
					}
					index++
				}

				if (issues != null)
					return failure(issues)
				if (output != null)
					return success(output)

				output = new Map()
				for (let bufferIndex = 0; bufferIndex < bufferCount; bufferIndex++)
					output.set(bufferKeys![bufferIndex], bufferValues![bufferIndex])
				return success(output)
			}

			let output: Map<unknown, unknown> | undefined
			let firstKeyMeta: Map<unknown, { index: number, sourceKey: unknown }> | undefined
			let issues: AnyExecutionIssue[] | undefined
			let index = 0

			for (let step = iterator.next(); !step.done; step = iterator.next()) {
				const sourceKey = step.value[0]
				const sourceValue = step.value[1]
				const keyResult = keyExecute(sourceKey)
				if (isPromiseLike(keyResult)) {
					return continueAsync(value, iterator, keyResult, 'key', sourceKey, sourceValue, undefined, output, firstKeyMeta, issues, index)
				}

				const syncKeyResult = keyResult as ExecutionResult
				const keyFailed = isFailure(syncKeyResult)
				if (keyFailed) {
					const appended = appendChildIssues(syncKeyResult, [index, 'key'], issues)
					issues = appended.issues
					if (appended.hasInternal || !collectAllIssues)
						return failure(issues)
				}

				const valueResult = valueExecute(sourceValue)
				if (isPromiseLike(valueResult)) {
					return continueAsync(value, iterator, valueResult, 'value', sourceKey, sourceValue, syncKeyResult, output, firstKeyMeta, issues, index)
				}

				const syncValueResult = valueResult as ExecutionResult
				const valueFailed = isFailure(syncValueResult)
				if (valueFailed) {
					const appended = appendChildIssues(syncValueResult, [index, 'value'], issues)
					issues = appended.issues
					if (appended.hasInternal || !collectAllIssues)
						return failure(issues)
				}

				if (!keyFailed && !valueFailed) {
					const transformedKey = syncKeyResult.value
					if (output?.has(transformedKey)) {
						const first = firstKeyMeta!.get(transformedKey)
						if (first == null)
							throw new Error('Missing transformed Map key metadata.')
						const target = issues ??= []
						target.push(createDuplicateIssue(value, first.sourceKey, first.index, sourceKey, index, transformedKey))
						if (!collectAllIssues)
							return failure(target)
					}
					else {
						output ??= new Map()
						firstKeyMeta ??= new Map()
						output.set(transformedKey, syncValueResult.value)
						firstKeyMeta.set(transformedKey, { index, sourceKey })
					}
				}
				index++
			}

			return issues == null ? success(output ?? new Map()) : failure(issues)
		}, operationMode)
	},
})
