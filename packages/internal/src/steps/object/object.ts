import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, Next, OperationMode, StructuralStepOptions, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, IsExactlyAnyOrUnknown, Simplify, ValueOf } from '../../shared'
import { implStepPlugin } from '../../core'
import { isPromiseLike } from '../../shared'

declare namespace Internal {
	export type Struct = Record<PropertyKey, Use<Valchecker> | [optional: Use<Valchecker>]>

	export type OpMode<S extends Struct> = ValueOf<{
		[K in keyof S]: S[K] extends Use<Valchecker>
			? InferOperationMode<S[K]>
			: S[K] extends [optional: Use<Valchecker>]
				? InferOperationMode<S[K][0]>
				: never
	}> extends infer M
		? [M] extends [never]
				? 'sync'
				: M extends OperationMode
					? IsEqual<M, 'sync'> extends true ? 'sync' : 'maybe-async'
					: never
		: never

	export type Output<S extends Struct> = Simplify<
		{
			[K in keyof S as S[K] extends Use<Valchecker> ? K : never]: S[K] extends Use<Valchecker> ? InferOutput<S[K]> : never
		} & {
			[K in keyof S as S[K] extends [optional: Use<Valchecker>] ? K : never]: S[K] extends [optional: Use<Valchecker>] ? InferOutput<S[K][0]> | undefined : never
		}
	>

	export type Issue<S extends Struct = never>
		= | ExecutionIssue<'object:expected_object', { value: unknown }>
			| ExecutionIssue<'object:missing_key', { key: PropertyKey }>
			| (
				IsEqual<S, never> extends true
					? never
					: ValueOf<{
						[K in keyof S]: S[K] extends Use<Valchecker>
							? InferIssue<S[K]>
							: S[K] extends [optional: Use<Valchecker>]
								? InferIssue<S[K][0]>
								: never
					}>
			)
}

type Meta = DefineStepMethodMeta<{
	Name: 'object'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is an object. Extra keys are ignored.
	 *
	 * Required keys that are not own properties produce `'object:missing_key'`.
	 * An own property whose value is `undefined` is still validated by its child schema.
	 * Declared-field traversal stops after the first issue unless
	 * `collectAllIssues` is enabled.
	 */
	object: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				? <S extends Internal.Struct>(
						struct: S,
						options?: StructuralStepOptions<Internal.Issue<NoInfer<S>>>,
					) => Next<{
						operationMode: Internal.OpMode<NoInfer<S>>
						output: Internal.Output<NoInfer<S>>
						issue: Internal.Issue<NoInfer<S>>
					}, this['CurrentValchecker']>
				: never
			: never
	>
}

interface PropMeta {
	key: PropertyKey
	isOptional: boolean
	execute: Use<Valchecker>['~execute']
}

function getOwnValue(value: object, key: PropertyKey): unknown {
	return (value as Record<PropertyKey, unknown>)[key]
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

/* @__NO_SIDE_EFFECTS__ */
export const object = implStepPlugin<PluginDef>({
	object: ({
		utils: { addSuccessStep, success, createIssue, failure, isFailure, prependIssuePath },
		params: [struct, options],
	}) => {
		const keys: PropertyKey[] = Object.keys(struct)
		const symbols = Object.getOwnPropertySymbols(struct)
		for (let i = 0; i < symbols.length; i++) {
			const key = symbols[i]!
			if (Object.prototype.propertyIsEnumerable.call(struct, key))
				keys.push(key)
		}
		const keysLen = keys.length
		let operationMode: OperationMode = 'sync'
		const propsMeta: PropMeta[] = []

		for (let i = 0; i < keysLen; i++) {
			const key = keys[i]!
			const prop = struct[key]!
			const isOptional = Array.isArray(prop)
			const schema = isOptional ? prop[0]! : prop
			propsMeta.push({ key, isOptional, execute: schema['~execute'] })
			if (schema['~core']?.operationMode !== 'sync')
				operationMode = 'maybe-async'
		}

		const childrenAreSynchronous = operationMode === 'sync'
		const collectAllIssues = options?.collectAllIssues === true

		const expectedObjectFailure = (value: unknown) => failure(createIssue({
			code: 'object:expected_object',
			payload: { value },
			customMessage: options?.message,
			defaultMessage: 'Expected an object.',
		}))

		const missingKeyFailure = (key: PropertyKey) => failure(createIssue({
			code: 'object:missing_key',
			payload: { key },
			path: [key],
			customMessage: options?.message,
			defaultMessage: 'Missing required object key.',
		}))

		const prependChildIssues = (result: ExecutionResult, key: PropertyKey): AnyExecutionIssue[] => {
			const issues: AnyExecutionIssue[] = []
			if (isFailure(result)) {
				for (const issue of result.issues)
					issues.push(prependIssuePath(issue, [key], options?.message))
			}
			return issues
		}

		const executeFirstIssue = (value: unknown) => {
			if (typeof value !== 'object' || value == null || Array.isArray(value))
				return expectedObjectFailure(value)

			const output: Record<PropertyKey, any> = {}

			const continueAsync = async (
				startIndex: number,
				firstResult: PromiseLike<ExecutionResult>,
			): Promise<ExecutionResult> => {
				for (let i = startIndex; i < keysLen; i++) {
					const meta = propsMeta[i]!
					let result: ExecutionResult
					if (i === startIndex) {
						result = await firstResult
					}
					else if (!Object.hasOwn(value, meta.key)) {
						if (meta.isOptional) {
							setOutputValue(output, meta.key, undefined)
							continue
						}
						return missingKeyFailure(meta.key)
					}
					else {
						result = await meta.execute(getOwnValue(value, meta.key))
					}

					if (isFailure(result))
						return failure(prependChildIssues(result, meta.key))
					setOutputValue(output, meta.key, result.value)
				}
				return success(output)
			}

			for (let i = 0; i < keysLen; i++) {
				const meta = propsMeta[i]!
				const key = meta.key
				if (!Object.hasOwn(value, key)) {
					if (meta.isOptional) {
						setOutputValue(output, key, undefined)
						continue
					}
					return missingKeyFailure(key)
				}

				const result = meta.execute(getOwnValue(value, key))
				if (!childrenAreSynchronous && isPromiseLike(result))
					return continueAsync(i, result)

				const syncResult = result as ExecutionResult
				if (isFailure(syncResult))
					return failure(prependChildIssues(syncResult, key))
				setOutputValue(output, key, syncResult.value)
			}
			return success(output)
		}

		const executeCollectAll = (value: unknown) => {
			if (typeof value !== 'object' || value == null || Array.isArray(value))
				return expectedObjectFailure(value)

			let issues: AnyExecutionIssue[] | undefined
			const output: Record<PropertyKey, any> = {}

			const appendChildIssues = (result: ExecutionResult, key: PropertyKey): boolean => {
				if (!isFailure(result))
					return false
				let hasInternal = false
				const target = issues ??= []
				for (const issue of result.issues) {
					if (issue.category === 'internal')
						hasInternal = true
					target.push(prependIssuePath(issue, [key], options?.message))
				}
				return hasInternal
			}

			const appendMissingKey = (key: PropertyKey): void => {
				(issues ??= []).push(createIssue({
					code: 'object:missing_key',
					payload: { key },
					path: [key],
					customMessage: options?.message,
					defaultMessage: 'Missing required object key.',
				}))
			}

			const continueAsync = async (
				startIndex: number,
				firstResult: PromiseLike<ExecutionResult>,
			): Promise<ExecutionResult> => {
				for (let i = startIndex; i < keysLen; i++) {
					const meta = propsMeta[i]!
					let result: ExecutionResult
					if (i === startIndex) {
						result = await firstResult
					}
					else if (!Object.hasOwn(value, meta.key)) {
						if (meta.isOptional)
							setOutputValue(output, meta.key, undefined)
						else
							appendMissingKey(meta.key)
						continue
					}
					else {
						result = await meta.execute(getOwnValue(value, meta.key))
					}

					if (appendChildIssues(result, meta.key))
						return failure(issues!)
					if (!isFailure(result))
						setOutputValue(output, meta.key, result.value)
				}
				return issues == null ? success(output) : failure(issues)
			}

			for (let i = 0; i < keysLen; i++) {
				const meta = propsMeta[i]!
				const key = meta.key
				if (!Object.hasOwn(value, key)) {
					if (meta.isOptional)
						setOutputValue(output, key, undefined)
					else
						appendMissingKey(key)
					continue
				}

				const result = meta.execute(getOwnValue(value, key))
				if (!childrenAreSynchronous && isPromiseLike(result))
					return continueAsync(i, result)

				const syncResult = result as ExecutionResult
				if (appendChildIssues(syncResult, key))
					return failure(issues!)
				if (!isFailure(syncResult))
					setOutputValue(output, key, syncResult.value)
			}
			return issues == null ? success(output) : failure(issues)
		}

		addSuccessStep(collectAllIssues ? executeCollectAll : executeFirstIssue, operationMode)
	},
})