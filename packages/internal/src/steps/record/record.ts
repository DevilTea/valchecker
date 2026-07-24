import type { IsLiteral } from 'type-fest'
import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, ExecutionSuccessResult, InferExecutionContext, InferIssue, InferOperationMode, InferOutput, Next, OperationMode, StructuralStepOptions, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, IsExactlyAnyOrUnknown, Simplify } from '../../shared'
import { implStepPlugin } from '../../core'
import { isPromiseLike } from '../../shared'
import { getLiteralMembers } from '../literal/literal-members'

declare namespace Internal {
	// `true` when at least one constituent of a (possibly union) key output is a
	// literal; `true` only when every constituent is a literal.
	type SomeLiteral<T> = true extends (T extends unknown ? IsLiteral<T> : never) ? true : false
	type AllLiteral<T> = false extends (T extends unknown ? IsLiteral<T> : never) ? false : true

	type KeyMembers<K extends Use<Valchecker>> = InferExecutionContext<K>['literalMembers']
	type IsFiniteKey<K extends Use<Valchecker>> = KeyMembers<K> extends readonly unknown[] ? true : false

	// Rejects only the incoherent quadrant: a type-finite (literal-union) key
	// domain that carries no runtime member set to enforce exhaustiveness. Open
	// domains (`string`/`number`/`symbol`/template) and coherent finite domains
	// (members present AND every constituent a literal) are accepted.
	export type ValidKeySchema<K extends Use<Valchecker>>
		= IsExactlyAnyOrUnknown<InferOutput<K>> extends true
			? false
			: InferOutput<K> extends PropertyKey
				? IsFiniteKey<K> extends true
					? AllLiteral<InferOutput<K>>
					: SomeLiteral<InferOutput<K>> extends true
						? false
						: true
				: false

	export type Output<K extends Use<Valchecker>, V extends Use<Valchecker>>
		= Simplify<Record<Extract<InferOutput<K>, PropertyKey>, InferOutput<V>>>

	type ResolveMode<M extends OperationMode> = IsEqual<M, 'sync'> extends true ? 'sync' : 'maybe-async'
	export type OpMode<K extends Use<Valchecker>, V extends Use<Valchecker>> = ResolveMode<InferOperationMode<K> | InferOperationMode<V>>

	export type ExpectedIssue = ExecutionIssue<'record:expected_object', { value: unknown }>
	export type MissingKeyIssue = ExecutionIssue<'record:missing_key', { key: PropertyKey }>
	export type UnexpectedKeysIssue = ExecutionIssue<'record:unexpected_keys', { keys: PropertyKey[], expectedKeys: PropertyKey[] }>
	export type DuplicateTransformedKeyIssue<TK = unknown> = ExecutionIssue<
		'record:duplicate_transformed_key',
		{ value: Record<PropertyKey, unknown>, firstSourceKey: PropertyKey, sourceKey: PropertyKey, transformedKey: TK }
	>
	export type SelfIssue = ExpectedIssue | MissingKeyIssue | UnexpectedKeysIssue | DuplicateTransformedKeyIssue

	export type Issue<K extends Use<Valchecker>, V extends Use<Valchecker>>
		= | ExpectedIssue
			| (IsFiniteKey<K> extends true
				? MissingKeyIssue | UnexpectedKeysIssue
				: DuplicateTransformedKeyIssue<InferOutput<K>> | InferIssue<K>)
			| InferIssue<V>

	export interface Options<K extends Use<Valchecker>, V extends Use<Valchecker>>
		extends StructuralStepOptions<Issue<NoInfer<K>, NoInfer<V>>> {
		readonly key: K
		readonly value: V
	}
}

type Meta = DefineStepMethodMeta<{
	Name: 'record'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.SelfIssue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Validates and transforms every own enumerable entry of a plain object,
	 * aligning with TypeScript's `Record<K, V>`. The key schema, value schema,
	 * enclosing message, and issue-collection policy are supplied through one
	 * configuration object.
	 *
	 * When the key schema advertises a finite member set (a `literal`, a union of
	 * literals, or `isOneOf`), the record is treated as CLOSED and EXHAUSTIVE:
	 * every member key is required (`'record:missing_key'`) and any extra key is
	 * rejected (`'record:unexpected_keys'`). In this finite mode the key schema is
	 * never executed. Otherwise (`string`/`number`/`symbol`/template key output)
	 * the record is OPEN: the key schema runs on every own enumerable key and
	 * transformed keys must remain unique (`'record:duplicate_transformed_key'`).
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, number, record, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [record, string, number] })
	 * const schema = v.record({ key: v.string(), value: v.number() })
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'record:expected_object'`: The value is not a plain object.
	 * - `'record:missing_key'`: A required finite-domain key is not present.
	 * - `'record:unexpected_keys'`: The value carries keys outside the finite domain.
	 * - `'record:duplicate_transformed_key'`: Two source keys produced the same transformed key.
	 */
	record: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? IsExactlyAnyOrUnknown<InferOutput<This>> extends true
				? <K extends Use<Valchecker>, V extends Use<Valchecker>>(
						// The gate intersects a phantom required `never` property onto
						// `options` rather than onto `key`: overriding `key` would collapse
						// `options.key` to `never` at the generic impl instantiation, while a
						// property the impl never reads leaves `options` intact and still
						// forces a diagnostic (a missing required property) at an invalid
						// call site.
						options: Internal.Options<K, V> & (Internal.ValidKeySchema<K> extends true ? unknown : { readonly __invalidRecordKeySchema: never }),
					) => Next<{
						operationMode: Internal.OpMode<K, V>
						output: Internal.Output<K, V>
						issue: Internal.Issue<K, V>
					}, This>
				: never
			: never
	>
}

function setOutputValue(output: Record<PropertyKey, any>, key: PropertyKey, value: unknown): void {
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

function collectOwnKeys(value: object): PropertyKey[] {
	const ownKeys: PropertyKey[] = Object.keys(value)
	const ownSymbols = Object.getOwnPropertySymbols(value)
	for (let i = 0; i < ownSymbols.length; i++) {
		const key = ownSymbols[i]!
		if (Object.prototype.propertyIsEnumerable.call(value, key))
			ownKeys.push(key)
	}
	return ownKeys
}

/* @__NO_SIDE_EFFECTS__ */
export const record = implStepPlugin<PluginDef>({
	record: ({
		utils: { addSuccessStep, success, createIssue, failure, isFailure, prependIssuePath, appendIssueContext },
		params: [options],
	}) => {
		const keyExecute = options.key['~execute']
		const valueExecute = options.value['~execute']
		const operationMode: OperationMode = options.key['~core']?.operationMode === 'sync'
			&& options.value['~core']?.operationMode === 'sync'
			? 'sync'
			: 'maybe-async'
		const childrenAreSynchronous = operationMode === 'sync'
		const collectAllIssues = options.collectAllIssues === true
		// The public `Issue<K, V>` conditionally drops finite-only self codes, so at
		// this generic impl boundary the options message type does not cover every
		// code we may raise. Widen it to the full self-issue handler; the runtime
		// resolver simply ignores codes a map handler does not name.
		const message = options.message as StructuralStepOptions<Internal.SelfIssue>['message']

		// Finite key domains canonicalize their members to property keys once at
		// construction. A number member collapses to its string key (`1` -> `'1'`),
		// matching TS `Record<1 | '1', V>`; dedupe preserves first occurrence.
		const members = getLiteralMembers(options.key)
		let memberKeys: PropertyKey[] | undefined
		let memberSet: Set<PropertyKey> | undefined
		if (members != null) {
			memberKeys = []
			memberSet = new Set<PropertyKey>()
			for (let i = 0; i < members.length; i++) {
				const member = members[i]
				const type = typeof member
				let key: PropertyKey
				if (type === 'string' || type === 'symbol')
					key = member as string | symbol
				else if (type === 'number')
					key = String(member)
				else
					throw new TypeError('record() key schema advertises members that are not valid property keys.')
				if (!memberSet.has(key)) {
					memberSet.add(key)
					memberKeys.push(key)
				}
			}
		}

		const appendMissingKey = (
			key: PropertyKey,
			issues: AnyExecutionIssue[] | undefined,
		): AnyExecutionIssue[] => {
			const target = issues ?? []
			target.push(createIssue({
				code: 'record:missing_key',
				payload: { key },
				path: [key],
				customMessage: message,
				defaultMessage: 'Missing required record key.',
			}))
			return target
		}

		// Deliberately duplicated per-file: V8 inlines this local closure but not a shared cross-module helper. See architecture.md.
		const appendChildIssues = (
			result: ExecutionResult,
			key: PropertyKey,
			issues: AnyExecutionIssue[] | undefined,
		): { issues: AnyExecutionIssue[], hasInternal: boolean } => {
			let hasInternal = false
			const target = issues ?? []
			if (isFailure(result)) {
				for (const issue of result.issues) {
					if (issue.category === 'internal')
						hasInternal = true
					target.push(prependIssuePath(issue, [key], message))
				}
			}
			return { issues: target, hasInternal }
		}

		const appendKeyIssues = (
			result: ExecutionResult,
			sourceKey: PropertyKey,
			issues: AnyExecutionIssue[] | undefined,
		): { issues: AnyExecutionIssue[], hasInternal: boolean } => {
			let hasInternal = false
			const target = issues ?? []
			if (isFailure(result)) {
				for (const issue of result.issues) {
					if (issue.category === 'internal')
						hasInternal = true
					target.push(appendIssueContext(
						prependIssuePath(issue, [sourceKey], message),
						{ type: 'record', part: 'key' },
					))
				}
			}
			return { issues: target, hasInternal }
		}

		if (memberKeys != null) {
			// FINITE MODE: closed and exhaustive; the key schema is never executed.
			const keys = memberKeys
			const keySet = memberSet!

			const continueAsync = async (
				value: object,
				startIndex: number,
				firstResult: PromiseLike<ExecutionResult>,
				output: Record<PropertyKey, any> | undefined,
				issues: AnyExecutionIssue[] | undefined,
			) => {
				for (let i = startIndex; i < keys.length; i++) {
					const key = keys[i]!
					let result: ExecutionResult
					if (i === startIndex) {
						result = await firstResult
					}
					else if (!Object.hasOwn(value, key)) {
						issues = appendMissingKey(key, issues)
						output = undefined
						if (!collectAllIssues)
							return failure(issues)
						continue
					}
					else {
						result = await valueExecute((value as Record<PropertyKey, unknown>)[key])
					}

					if (isFailure(result)) {
						const appended = appendChildIssues(result, key, issues)
						issues = appended.issues
						output = undefined
						if (appended.hasInternal || !collectAllIssues)
							return failure(issues)
					}
					else if (output != null) {
						setOutputValue(output, key, result.value)
					}
				}
				return issues == null ? success(output!) : failure(issues)
			}

			addSuccessStep((value) => {
				if (typeof value !== 'object' || value == null || Array.isArray(value)) {
					return failure(createIssue({
						code: 'record:expected_object',
						payload: { value },
						customMessage: message,
						defaultMessage: 'Expected an object.',
					}))
				}

				let issues: AnyExecutionIssue[] | undefined
				let output: Record<PropertyKey, any> | undefined = {}

				const ownKeys = collectOwnKeys(value)
				let unknownKeys: PropertyKey[] | undefined
				for (let i = 0; i < ownKeys.length; i++) {
					const key = ownKeys[i]!
					if (!keySet.has(key))
						(unknownKeys ??= []).push(key)
				}
				if (unknownKeys != null) {
					issues = [createIssue({
						code: 'record:unexpected_keys',
						payload: { keys: unknownKeys, expectedKeys: [...keys] },
						customMessage: message,
						defaultMessage: 'Unexpected record keys found.',
					})]
					output = undefined
					if (!collectAllIssues)
						return failure(issues)
				}

				for (let i = 0; i < keys.length; i++) {
					const key = keys[i]!
					if (!Object.hasOwn(value, key)) {
						issues = appendMissingKey(key, issues)
						output = undefined
						if (!collectAllIssues)
							return failure(issues)
						continue
					}

					const result = valueExecute((value as Record<PropertyKey, unknown>)[key])
					if (!childrenAreSynchronous && isPromiseLike(result))
						return continueAsync(value, i, result, output, issues)

					const syncResult = result as ExecutionResult
					if (isFailure(syncResult)) {
						const appended = appendChildIssues(syncResult, key, issues)
						issues = appended.issues
						output = undefined
						if (appended.hasInternal || !collectAllIssues)
							return failure(issues)
					}
					else if (output != null) {
						setOutputValue(output, key, syncResult.value)
					}
				}

				return issues == null ? success(output!) : failure(issues)
			}, operationMode)
			return
		}

		// NON-FINITE MODE: open domain; the key schema runs on every own key and
		// transformed keys must stay unique.
		const recordEntry = (
			value: object,
			sourceKey: PropertyKey,
			keyResult: ExecutionSuccessResult<unknown>,
			valueResult: ExecutionSuccessResult<unknown>,
			output: Record<PropertyKey, any>,
			seen: Map<PropertyKey, PropertyKey>,
			issues: AnyExecutionIssue[] | undefined,
		): { issues: AnyExecutionIssue[] | undefined, stop: boolean } => {
			const transformedKey = keyResult.value as PropertyKey
			const canonicalKey = typeof transformedKey === 'number' ? String(transformedKey) : transformedKey
			if (seen.has(canonicalKey)) {
				const target = issues ?? []
				target.push(createIssue({
					code: 'record:duplicate_transformed_key',
					payload: {
						value: value as Record<PropertyKey, unknown>,
						firstSourceKey: seen.get(canonicalKey)!,
						sourceKey,
						transformedKey,
					},
					path: [canonicalKey],
					customMessage: message,
					defaultMessage: 'Expected transformed record keys to be unique.',
				}))
				return { issues: target, stop: !collectAllIssues }
			}
			seen.set(canonicalKey, sourceKey)
			setOutputValue(output, canonicalKey, valueResult.value)
			return { issues, stop: false }
		}

		const continueAsync = async (
			value: object,
			keys: PropertyKey[],
			startIndex: number,
			pending: PromiseLike<ExecutionResult>,
			phase: 'key' | 'value',
			resolvedKey: ExecutionResult | undefined,
			output: Record<PropertyKey, any>,
			seen: Map<PropertyKey, PropertyKey>,
			issues: AnyExecutionIssue[] | undefined,
		) => {
			const firstKey = keys[startIndex]!
			const keyResult = phase === 'key' ? await pending : resolvedKey!
			const keyFailed = isFailure(keyResult)
			// When suspension happened on the value, the sync loop already appended
			// any key failure for this entry; re-appending would duplicate it.
			if (keyFailed && phase === 'key') {
				const appended = appendKeyIssues(keyResult, firstKey, issues)
				issues = appended.issues
				if (appended.hasInternal || !collectAllIssues)
					return failure(issues)
			}

			const valueResult = phase === 'value' ? await pending : await valueExecute((value as Record<PropertyKey, unknown>)[firstKey])
			const valueFailed = isFailure(valueResult)
			if (valueFailed) {
				const appended = appendChildIssues(valueResult, firstKey, issues)
				issues = appended.issues
				if (appended.hasInternal || !collectAllIssues)
					return failure(issues)
			}

			if (!keyFailed && !valueFailed) {
				const entry = recordEntry(value, firstKey, keyResult, valueResult, output, seen, issues)
				issues = entry.issues
				if (entry.stop)
					return failure(issues!)
			}

			for (let i = startIndex + 1; i < keys.length; i++) {
				const key = keys[i]!
				const currentKeyResult = await keyExecute(key)
				const currentKeyFailed = isFailure(currentKeyResult)
				if (currentKeyFailed) {
					const appended = appendKeyIssues(currentKeyResult, key, issues)
					issues = appended.issues
					if (appended.hasInternal || !collectAllIssues)
						return failure(issues)
				}

				const currentValueResult = await valueExecute((value as Record<PropertyKey, unknown>)[key])
				const currentValueFailed = isFailure(currentValueResult)
				if (currentValueFailed) {
					const appended = appendChildIssues(currentValueResult, key, issues)
					issues = appended.issues
					if (appended.hasInternal || !collectAllIssues)
						return failure(issues)
				}

				if (!currentKeyFailed && !currentValueFailed) {
					const entry = recordEntry(value, key, currentKeyResult, currentValueResult, output, seen, issues)
					issues = entry.issues
					if (entry.stop)
						return failure(issues!)
				}
			}

			return issues == null ? success(output) : failure(issues)
		}

		addSuccessStep((value) => {
			if (typeof value !== 'object' || value == null || Array.isArray(value)) {
				return failure(createIssue({
					code: 'record:expected_object',
					payload: { value },
					customMessage: message,
					defaultMessage: 'Expected an object.',
				}))
			}

			const keys = collectOwnKeys(value)
			const output: Record<PropertyKey, any> = {}
			const seen = new Map<PropertyKey, PropertyKey>()
			let issues: AnyExecutionIssue[] | undefined

			for (let i = 0; i < keys.length; i++) {
				const key = keys[i]!
				const keyResult = keyExecute(key)
				if (!childrenAreSynchronous && isPromiseLike(keyResult))
					return continueAsync(value, keys, i, keyResult, 'key', undefined, output, seen, issues)

				const syncKeyResult = keyResult as ExecutionResult
				const keyFailed = isFailure(syncKeyResult)
				if (keyFailed) {
					const appended = appendKeyIssues(syncKeyResult, key, issues)
					issues = appended.issues
					if (appended.hasInternal || !collectAllIssues)
						return failure(issues)
				}

				const valueResult = valueExecute((value as Record<PropertyKey, unknown>)[key])
				if (!childrenAreSynchronous && isPromiseLike(valueResult))
					return continueAsync(value, keys, i, valueResult, 'value', syncKeyResult, output, seen, issues)

				const syncValueResult = valueResult as ExecutionResult
				const valueFailed = isFailure(syncValueResult)
				if (valueFailed) {
					const appended = appendChildIssues(syncValueResult, key, issues)
					issues = appended.issues
					if (appended.hasInternal || !collectAllIssues)
						return failure(issues)
				}

				if (!keyFailed && !valueFailed) {
					const entry = recordEntry(value, key, syncKeyResult, syncValueResult, output, seen, issues)
					issues = entry.issues
					if (entry.stop)
						return failure(issues!)
				}
			}

			return issues == null ? success(output) : failure(issues)
		}, operationMode)
	},
})
