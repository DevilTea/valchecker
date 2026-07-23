import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, Next, OperationMode, StructuralStepOptions, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'
import { isPromiseLike } from '../../shared'

const nativeMapForEach = Map.prototype.forEach

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

		const snapshotEntries = (
			value: Map<unknown, unknown>,
			size: number,
			forEach: typeof Map.prototype.forEach,
		): unknown[] => {
			// eslint-disable-next-line unicorn/no-new-array
			const entries = new Array<unknown>(size * 2)
			let offset = 0
			Reflect.apply(forEach, value, [
				(sourceValue: unknown, sourceKey: unknown) => {
					entries[offset++] = sourceKey
					entries[offset++] = sourceValue
				},
			])
			return entries
		}

		const createDuplicateIssue = (
			value: Map<unknown, unknown>,
			entries: unknown[],
			firstIndex: number,
			sourceKey: unknown,
			index: number,
			transformedKey: unknown,
		) => createIssue({
			code: 'map:duplicate_transformed_key',
			payload: {
				value,
				firstSourceKey: entries[firstIndex * 2],
				sourceKey,
				transformedKey,
				firstIndex,
				index,
			},
			path: [index, 'key'],
			customMessage: options.message,
			defaultMessage: 'Expected transformed Map keys to be unique.',
		})

		const continueAsync = async (
			value: Map<unknown, unknown>,
			entries: unknown[],
			startIndex: number,
			pending: PromiseLike<ExecutionResult>,
			phase: 'key' | 'value',
			output: Map<unknown, unknown> | undefined,
			firstKeyIndex: Map<unknown, number> | undefined,
			issues: AnyExecutionIssue[] | undefined,
			resolvedKey?: ExecutionResult,
		) => {
			const entryCount = entries.length / 2
			for (let index = startIndex; index < entryCount; index++) {
				const offset = index * 2
				const sourceKey = entries[offset]
				const sourceValue = entries[offset + 1]
				const keyWasProcessed = index === startIndex && phase === 'value'
				const keyResult = index === startIndex
					? phase === 'key' ? await pending : resolvedKey!
					: await keyExecute(sourceKey)
				const keyFailed = isFailure(keyResult)

				if (!keyWasProcessed && keyFailed) {
					const appended = appendChildIssues(keyResult, [index, 'key'], issues)
					issues = appended.issues
					if (appended.hasInternal || !collectAllIssues)
						return failure(issues)
				}

				const valueResult = index === startIndex && phase === 'value'
					? await pending
					: await valueExecute(sourceValue)
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
						const firstIndex = firstKeyIndex!.get(transformedKey)
						if (firstIndex == null)
							throw new Error('Missing transformed Map key metadata.')
						const target = issues ??= []
						target.push(createDuplicateIssue(value, entries, firstIndex, sourceKey, index, transformedKey))
						if (!collectAllIssues)
							return failure(target)
					}
					else {
						output ??= new Map()
						firstKeyIndex ??= new Map()
						output.set(transformedKey, valueResult.value)
						firstKeyIndex.set(transformedKey, index)
					}
				}
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

			const size = value.size
			const forEach = value.forEach
			const entries = snapshotEntries(value, size, forEach)
			const entryCount = entries.length / 2

			if (childrenAreSynchronous && forEach === nativeMapForEach) {
				let output: Map<unknown, unknown> | undefined
				let firstKeyIndex: Map<unknown, number> | undefined
				let hasFailure = false
				let issues: AnyExecutionIssue[] | undefined

				for (let index = 0; index < entryCount; index++) {
					const offset = index * 2
					const sourceKey = entries[offset]
					const sourceValue = entries[offset + 1]
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

					if (keyFailed || valueFailed) {
						// Keep rebuilding output after a recoverable failure: the output Map doubles as duplicate-detection state, so skipping it drops map:duplicate_transformed_key issues. See architecture.md (2026-07-22).
						if (!hasFailure && output == null && index > 0) {
							output = new Map()
							firstKeyIndex = new Map()
							for (let prefixIndex = 0; prefixIndex < index; prefixIndex++) {
								const prefixOffset = prefixIndex * 2
								const prefixKey = entries[prefixOffset]
								output.set(prefixKey, entries[prefixOffset + 1])
								firstKeyIndex.set(prefixKey, prefixIndex)
							}
						}
						hasFailure = true
						continue
					}

					const transformedKey = keyResult.value
					const transformedValue = valueResult.value
					const keyIsIdentity = transformedKey === sourceKey
						// eslint-disable-next-line no-self-compare -- intentional NaN self-comparison implementing SameValueZero identity (x !== x is true only for NaN)
						|| (transformedKey !== transformedKey && sourceKey !== sourceKey)
					if (
						output == null
						&& !hasFailure
						&& keyIsIdentity
						&& Object.is(transformedValue, sourceValue)
					) {
						continue
					}

					if (output == null) {
						output = new Map()
						firstKeyIndex = new Map()
						if (!hasFailure) {
							for (let prefixIndex = 0; prefixIndex < index; prefixIndex++) {
								const prefixOffset = prefixIndex * 2
								const prefixKey = entries[prefixOffset]
								output.set(prefixKey, entries[prefixOffset + 1])
								firstKeyIndex.set(prefixKey, prefixIndex)
							}
						}
					}

					if (output.has(transformedKey)) {
						const firstIndex = firstKeyIndex!.get(transformedKey)
						if (firstIndex == null)
							throw new Error('Missing transformed Map key metadata.')
						const target = issues ??= []
						target.push(createDuplicateIssue(value, entries, firstIndex, sourceKey, index, transformedKey))
						if (!collectAllIssues)
							return failure(target)
					}
					else {
						output.set(transformedKey, transformedValue)
						firstKeyIndex!.set(transformedKey, index)
					}
				}

				if (issues != null)
					return failure(issues)
				if (output != null)
					return success(output)

				output = new Map()
				for (let offset = 0; offset < entries.length; offset += 2)
					output.set(entries[offset], entries[offset + 1])
				return success(output)
			}

			let output: Map<unknown, unknown> | undefined
			let firstKeyIndex: Map<unknown, number> | undefined
			let issues: AnyExecutionIssue[] | undefined

			for (let index = 0; index < entryCount; index++) {
				const offset = index * 2
				const sourceKey = entries[offset]
				const sourceValue = entries[offset + 1]
				const keyResult = keyExecute(sourceKey)
				if (!childrenAreSynchronous && isPromiseLike(keyResult)) {
					return continueAsync(
						value,
						entries,
						index,
						keyResult,
						'key',
						output,
						firstKeyIndex,
						issues,
					)
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
				if (!childrenAreSynchronous && isPromiseLike(valueResult)) {
					return continueAsync(
						value,
						entries,
						index,
						valueResult,
						'value',
						output,
						firstKeyIndex,
						issues,
						syncKeyResult,
					)
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
						const firstIndex = firstKeyIndex!.get(transformedKey)
						if (firstIndex == null)
							throw new Error('Missing transformed Map key metadata.')
						const target = issues ??= []
						target.push(createDuplicateIssue(value, entries, firstIndex, sourceKey, index, transformedKey))
						if (!collectAllIssues)
							return failure(target)
					}
					else {
						output ??= new Map()
						firstKeyIndex ??= new Map()
						output.set(transformedKey, syncValueResult.value)
						firstKeyIndex.set(transformedKey, index)
					}
				}
			}

			return issues == null ? success(output ?? new Map()) : failure(issues)
		}, operationMode)
	},
})
