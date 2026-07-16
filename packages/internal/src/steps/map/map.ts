import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, MessageHandler, Next, OperationMode, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'
import { isPromiseLike } from '../../shared'

declare namespace Internal {
	type ResolveMode<M extends OperationMode> = IsEqual<M, 'sync'> extends true ? 'sync' : 'maybe-async'
	export type OpMode<K extends Use<Valchecker>, V extends Use<Valchecker>> = ResolveMode<InferOperationMode<K> | InferOperationMode<V>>
	export type SelfIssue = ExecutionIssue<'map:expected_map', { value: unknown }>
	export type Issue<K extends Use<Valchecker> = Use<Valchecker>, V extends Use<Valchecker> = Use<Valchecker>> = SelfIssue | InferIssue<K> | InferIssue<V>
}

type Meta = DefineStepMethodMeta<{
	Name: 'map'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.SelfIssue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * Validates and transforms every key and value of a `Map` in insertion order.
	 *
	 * @example `v.map(v.string(), v.number())`
	 * @issue `map:expected_map`
	 */
	map: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				? <K extends Use<Valchecker>, V extends Use<Valchecker>>(key: K, value: V, message?: MessageHandler<Internal.Issue<K, V>>) => Next<{
					operationMode: Internal.OpMode<K, V>
					output: Map<InferOutput<K>, InferOutput<V>>
					issue: Internal.Issue<K, V>
				}, this['CurrentValchecker']>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const map = implStepPlugin<PluginDef>({
	map: ({
		utils: { addSuccessStep, success, createIssue, failure, isFailure, prependIssuePath },
		params: [keySchema, valueSchema, message],
	}) => {
		const keyExecute = keySchema['~execute']
		const valueExecute = valueSchema['~execute']

		addSuccessStep((value) => {
			if (!(value instanceof Map)) {
				return failure(createIssue({
					code: 'map:expected_map',
					payload: { value },
					customMessage: message,
					defaultMessage: 'Expected a Map.',
				}))
			}

			const entries = [...value.entries()]
			const output = new Map<unknown, unknown>()
			const issues: ExecutionIssue[] = []
			const addIssues = (result: ExecutionResult, path: PropertyKey[]) => {
				if (!isFailure(result))
					return true
				for (const issue of result.issues)
					issues.push(prependIssuePath(issue, path))
				return false
			}
			const processEntry = (index: number): void | Promise<void> => {
				const [sourceKey, sourceValue] = entries[index]!
				const keyResult = keyExecute(sourceKey)
				const finishKey = (resolvedKey: ExecutionResult): void | Promise<void> => {
					const keyValid = addIssues(resolvedKey, [index, 'key'])
					const valueResult = valueExecute(sourceValue)
					const finishValue = (resolvedValue: ExecutionResult) => {
						const valueValid = addIssues(resolvedValue, [index, 'value'])
						if (keyValid && valueValid && !isFailure(resolvedKey) && !isFailure(resolvedValue))
							output.set(resolvedKey.value, resolvedValue.value)
					}
					return isPromiseLike(valueResult) ? Promise.resolve(valueResult).then(finishValue) : finishValue(valueResult)
				}
				return isPromiseLike(keyResult) ? Promise.resolve(keyResult).then(finishKey) : finishKey(keyResult)
			}

			for (let i = 0; i < entries.length; i++) {
				const result = processEntry(i)
				if (isPromiseLike(result)) {
					let chain = Promise.resolve(result)
					for (let j = i + 1; j < entries.length; j++) {
						const index = j
						chain = chain.then(() => processEntry(index))
					}
					return chain.then(() => issues.length > 0 ? failure(issues) : success(output as any))
				}
			}
			return issues.length > 0 ? failure(issues) : success(output as any)
		})
	},
})
