import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, Next, OperationMode, StepOptions, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'
import { isPromiseLike } from '../../shared'

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
	export interface Options<K extends Use<Valchecker>, V extends Use<Valchecker>> extends StepOptions<Issue<NoInfer<K>, NoInfer<V>>> {
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
	 * Validates and transforms every key and value of a `Map` in insertion order.
	 * The key and value schemas are supplied through one configuration object.
	 * Transformed keys must remain unique.
	 *
	 * @example `v.map({ key: v.string(), value: v.number() })`
	 * @issues `map:expected_map`, `map:duplicate_transformed_key`
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

interface FirstKeyMeta {
	firstSourceKey: unknown
	firstIndex: number
}

/* @__NO_SIDE_EFFECTS__ */
export const map = implStepPlugin<PluginDef>({
	map: ({
		utils: { addSuccessStep, success, createIssue, failure, isFailure, prependIssuePath },
		params: [options],
	}) => {
		const keyExecute = options.key['~execute']
		const valueExecute = options.value['~execute']

		addSuccessStep((value) => {
			if (!(value instanceof Map)) {
				return failure(createIssue({
					code: 'map:expected_map',
					payload: { value },
					customMessage: options.message,
					defaultMessage: 'Expected a Map.',
				}))
			}

			const entries = [...value.entries()]
			const output = new Map<unknown, unknown>()
			const firstKeyMeta = new Map<unknown, FirstKeyMeta>()
			let issues: AnyExecutionIssue[] | undefined

			const appendChildIssues = (result: ExecutionResult, path: PropertyKey[]): boolean => {
				if (!isFailure(result))
					return false
				let hasInternal = false
				const target = issues ??= []
				for (const issue of result.issues) {
					if (issue.category === 'internal')
						hasInternal = true
					target.push(prependIssuePath(issue, path, options.message))
				}
				return hasInternal
			}

			const commitEntry = (
				sourceKey: unknown,
				index: number,
				transformedKey: unknown,
				transformedValue: unknown,
			): void => {
				if (output.has(transformedKey)) {
					const first = firstKeyMeta.get(transformedKey)!
					(issues ??= []).push(createIssue({
						code: 'map:duplicate_transformed_key',
						payload: {
							value,
							firstSourceKey: first.firstSourceKey,
							sourceKey,
							transformedKey,
							firstIndex: first.firstIndex,
							index,
						},
						path: [index, 'key'],
						customMessage: options.message,
						defaultMessage: 'Expected transformed Map keys to be unique.',
					}))
					return
				}
				output.set(transformedKey, transformedValue)
				firstKeyMeta.set(transformedKey, { firstSourceKey: sourceKey, firstIndex: index })
			}

			const continueAsync = async (
				startIndex: number,
				pending: PromiseLike<ExecutionResult>,
				phase: 'key' | 'value',
				resolvedKey?: ExecutionResult,
			): Promise<ExecutionResult> => {
				for (let index = startIndex; index < entries.length; index++) {
					const [sourceKey, sourceValue] = entries[index]!
					const keyResult = index === startIndex
						? phase === 'key' ? await pending : resolvedKey!
						: await keyExecute(sourceKey)
					const keyFailed = isFailure(keyResult)
					if (keyFailed && appendChildIssues(keyResult, [index, 'key']))
						return failure(issues!)

					const valueResult = index === startIndex && phase === 'value'
						? await pending
						: await valueExecute(sourceValue)
					const valueFailed = isFailure(valueResult)
					if (valueFailed && appendChildIssues(valueResult, [index, 'value']))
						return failure(issues!)

					if (!keyFailed && !valueFailed)
						commitEntry(sourceKey, index, keyResult.value, valueResult.value)
				}
				return issues == null ? success(output) : failure(issues)
			}

			for (let index = 0; index < entries.length; index++) {
				const [sourceKey, sourceValue] = entries[index]!
				const keyResult = keyExecute(sourceKey)
				if (isPromiseLike(keyResult))
					return continueAsync(index, keyResult, 'key')

				const keyFailed = isFailure(keyResult)
				if (keyFailed && appendChildIssues(keyResult, [index, 'key']))
					return failure(issues!)

				const valueResult = valueExecute(sourceValue)
				if (isPromiseLike(valueResult))
					return continueAsync(index, valueResult, 'value', keyResult)

				const valueFailed = isFailure(valueResult)
				if (valueFailed && appendChildIssues(valueResult, [index, 'value']))
					return failure(issues!)

				if (!keyFailed && !valueFailed)
					commitEntry(sourceKey, index, keyResult.value, valueResult.value)
			}

			return issues == null ? success(output) : failure(issues)
		})
	},
})
