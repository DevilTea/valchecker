import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, MessageHandler, Next, OperationMode, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'
import { isPromiseLike } from '../../shared'

declare namespace Internal {
	export type FiniteKeys = readonly [PropertyKey, ...PropertyKey[]]
	export type BroadKeySchema<S extends Use<Valchecker>> = InferOutput<S> extends PropertyKey
		? string extends InferOutput<S>
			? S
			: number extends InferOutput<S>
				? S
				: symbol extends InferOutput<S>
					? S
					: never
		: never

	type ResolveMode<M> = M extends OperationMode
		? IsEqual<M, 'sync'> extends true ? 'sync' : 'maybe-async'
		: never

	export type OpMode<K extends Use<Valchecker> | undefined, V extends Use<Valchecker>> = ResolveMode<
		(K extends Use<Valchecker> ? InferOperationMode<K> : 'sync') | InferOperationMode<V>
	>

	export type SelfIssue
		= | ExecutionIssue<'record:expected_record', { value: unknown }>
			| ExecutionIssue<'record:missing_key', { value: object, key: PropertyKey }>
			| ExecutionIssue<'record:unexpected_key', { value: object, key: PropertyKey }>
			| ExecutionIssue<'record:duplicate_key', { value: object, key: PropertyKey }>

	export type Issue<K extends Use<Valchecker> | undefined = undefined, V extends Use<Valchecker> = Use<Valchecker>>
		= SelfIssue | (K extends Use<Valchecker> ? InferIssue<K> : never) | InferIssue<V>
}

type Meta = DefineStepMethodMeta<{
	Name: 'record'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.SelfIssue
}>

type RecordMethod<Current extends Use<Valchecker>> = {
	<const K extends Internal.FiniteKeys, V extends Use<Valchecker>>(keys: K, value: V, message?: MessageHandler<Internal.Issue<undefined, V>>): Next<{
		operationMode: Internal.OpMode<undefined, V>
		output: Record<K[number], InferOutput<V>>
		issue: Internal.Issue<undefined, V>
	}, Current>
	<K extends Use<Valchecker>, V extends Use<Valchecker>>(key: Internal.BroadKeySchema<K>, value: V, message?: MessageHandler<Internal.Issue<K, V>>): Next<{
		operationMode: Internal.OpMode<K, V>
		output: Record<Extract<InferOutput<K>, PropertyKey>, InferOutput<V>>
		issue: Internal.Issue<K, V>
	}, Current>
}

interface PluginDef extends TStepPluginDef {
	/**
	 * Validates object records. A finite key tuple produces an exhaustive TypeScript `Record`;
	 * a broad key schema models an index signature and validates each present key.
	 *
	 * @example `v.record(['en', 'zh-TW'], v.string())`
	 * @example `v.record(v.string(), v.number())`
	 * @issue `record:expected_record`
	 * @issue `record:missing_key`
	 * @issue `record:unexpected_key`
	 * @issue `record:duplicate_key`
	 */
	record: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				? RecordMethod<this['CurrentValchecker']>
				: never
			: never
	>
}

function ownEnumerableKeys(value: object): PropertyKey[] {
	return Reflect.ownKeys(value).filter(key => Object.prototype.propertyIsEnumerable.call(value, key))
}

function setObjectKey(output: Record<PropertyKey, unknown>, key: PropertyKey, value: unknown): void {
	if (key === '__proto__' && !Object.hasOwn(output, key)) {
		Object.defineProperty(output, key, {
			configurable: true,
			enumerable: true,
			value,
			writable: true,
		})
		return
	}
	output[key] = value
}

function canonicalObjectKey(key: PropertyKey): string | symbol {
	return typeof key === 'symbol' ? key : String(key)
}

function numericObjectKey(key: string): number | undefined {
	if (key.length === 0)
		return undefined
	const value = Number(key)
	return Number.isFinite(value) && String(value) === key ? value : undefined
}

function isSchema(value: unknown): value is Use<Valchecker> {
	return typeof value === 'object' && value !== null && typeof (value as Use<Valchecker>)['~execute'] === 'function'
}

/* @__NO_SIDE_EFFECTS__ */
export const record = implStepPlugin<PluginDef>({
	record: ({
		utils: { addSuccessStep, success, createIssue, failure, isFailure, prependIssuePath },
		params: [keysOrSchema, valueSchema, message],
	}) => {
		const keySchema = isSchema(keysOrSchema) ? keysOrSchema : undefined
		const finiteKeys = keySchema === undefined ? keysOrSchema : undefined
		const keyExecute = keySchema?.['~execute']
		const valueExecute = valueSchema['~execute']
		const expectedKeys = finiteKeys?.map(canonicalObjectKey)
		const expectedKeySet = expectedKeys === undefined ? undefined : new Set(expectedKeys)

		addSuccessStep((value) => {
			if (typeof value !== 'object' || value === null || Array.isArray(value)) {
				return failure(createIssue({
					code: 'record:expected_record',
					payload: { value },
					customMessage: message,
					defaultMessage: 'Expected a record object.',
				}))
			}

			const ownKeys = ownEnumerableKeys(value)
			if (finiteKeys !== undefined) {
				for (let i = 0; i < finiteKeys.length; i++) {
					if (!Object.hasOwn(value, finiteKeys[i]!)) {
						const key = finiteKeys[i]!
						return failure(createIssue({
							code: 'record:missing_key',
							payload: { value, key },
							path: [key],
							customMessage: message,
							defaultMessage: `Missing required record key "${String(key)}".`,
						}))
					}
				}
				for (const key of ownKeys) {
					if (!expectedKeySet!.has(canonicalObjectKey(key))) {
						return failure(createIssue({
							code: 'record:unexpected_key',
							payload: { value, key },
							path: [key],
							customMessage: message,
							defaultMessage: `Unexpected record key "${String(key)}".`,
						}))
					}
				}
			}

			const sourceKeys: PropertyKey[] = finiteKeys === undefined ? ownKeys : [...finiteKeys]
			const issues: ExecutionIssue[] = []
			const output: Record<PropertyKey, unknown> = {}
			const outputKeys = new Set<string | symbol>()

			const addIssues = (result: ExecutionResult, path: PropertyKey[]) => {
				if (isFailure(result)) {
					for (const issue of result.issues)
						issues.push(prependIssuePath(issue, path))
					return false
				}
				return true
			}

			const processEntry = (sourceKey: PropertyKey): void | Promise<void> => {
				const sourcePath = [sourceKey]
				const processValue = (outputKey: PropertyKey): void | Promise<void> => {
					const canonical = canonicalObjectKey(outputKey)
					if (outputKeys.has(canonical)) {
						issues.push(createIssue({
							code: 'record:duplicate_key',
							payload: { value, key: outputKey },
							path: sourcePath,
							customMessage: message,
							defaultMessage: `Record key "${String(outputKey)}" duplicates another transformed key.`,
						}))
						return
					}
					const valueResult = valueExecute(Reflect.get(value, sourceKey))
					const finishValue = (result: ExecutionResult) => {
						if (isFailure(result)) {
							addIssues(result, sourcePath)
							return
						}
						outputKeys.add(canonical)
						setObjectKey(output, outputKey, result.value)
					}
					return isPromiseLike(valueResult) ? Promise.resolve(valueResult).then(finishValue) : finishValue(valueResult)
				}

				if (keyExecute === undefined)
					return processValue(sourceKey)

				const keyResult = keyExecute(sourceKey)
				const finishKey = (result: ExecutionResult): void | Promise<void> => {
					if (isFailure(result)) {
						if (typeof sourceKey === 'string') {
							const numericKey = numericObjectKey(sourceKey)
							if (numericKey !== undefined) {
								const numericResult = keyExecute(numericKey)
								const finishNumeric = (resolved: ExecutionResult) => {
									if (isFailure(resolved)) {
										addIssues(resolved, sourcePath)
										return
									}
									return processValue(resolved.value as PropertyKey)
								}
								return isPromiseLike(numericResult) ? Promise.resolve(numericResult).then(finishNumeric) : finishNumeric(numericResult)
							}
						}
						addIssues(result, sourcePath)
						return
					}
					return processValue(result.value as PropertyKey)
				}
				return isPromiseLike(keyResult) ? Promise.resolve(keyResult).then(finishKey) : finishKey(keyResult)
			}

			for (let i = 0; i < sourceKeys.length; i++) {
				const result = processEntry(sourceKeys[i]!)
				if (isPromiseLike(result)) {
					let chain = Promise.resolve(result)
					for (let j = i + 1; j < sourceKeys.length; j++) {
						const key = sourceKeys[j]!
						chain = chain.then(() => processEntry(key))
					}
					return chain.then(() => issues.length > 0 ? failure(issues) : success(output as any))
				}
			}
			return issues.length > 0 ? failure(issues) : success(output as any)
		})
	},
})
