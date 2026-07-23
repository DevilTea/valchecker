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
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, number, object, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [object, string, number] })
	 * const schema = v.object({ name: v.string(), age: v.number() })
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'object:expected_object'`: The value is not an object.
	 * - `'object:missing_key'`: A required key is not an own property of the value.
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

		const appendMissingKey = (
			key: PropertyKey,
			issues: AnyExecutionIssue[] | undefined,
		): AnyExecutionIssue[] => {
			const target = issues ?? []
			target.push(createIssue({
				code: 'object:missing_key',
				payload: { key },
				path: [key],
				customMessage: options?.message,
				defaultMessage: 'Missing required object key.',
			}))
			return target
		}

		// Deliberately duplicated per-file: V8 inlines this local closure but not a shared cross-module helper. See architecture.md (extraction measured -12%/-13% on the failure hot path, 2026-07-22).
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
					target.push(prependIssuePath(issue, [key], options?.message))
				}
			}
			return { issues: target, hasInternal }
		}

		const continueAsync = async (
			value: object,
			startIndex: number,
			firstResult: PromiseLike<ExecutionResult>,
			output: Record<PropertyKey, any> | undefined,
			issues: AnyExecutionIssue[] | undefined,
		) => {
			for (let i = startIndex; i < keysLen; i++) {
				const meta = propsMeta[i]!
				let result: ExecutionResult
				if (i === startIndex) {
					result = await firstResult
				}
				else if (!Object.hasOwn(value, meta.key)) {
					if (meta.isOptional) {
						if (output != null)
							setOutputValue(output, meta.key, undefined)
						continue
					}
					issues = appendMissingKey(meta.key, issues)
					output = undefined
					if (!collectAllIssues)
						return failure(issues)
					continue
				}
				else {
					result = await meta.execute(getOwnValue(value, meta.key))
				}

				if (isFailure(result)) {
					const appended = appendChildIssues(result, meta.key, issues)
					issues = appended.issues
					output = undefined
					if (appended.hasInternal || !collectAllIssues)
						return failure(issues)
				}
				else if (output != null) {
					setOutputValue(output, meta.key, result.value)
				}
			}

			return issues == null ? success(output!) : failure(issues)
		}

		addSuccessStep((value) => {
			if (typeof value !== 'object' || value == null || Array.isArray(value)) {
				return failure(createIssue({
					code: 'object:expected_object',
					payload: { value },
					customMessage: options?.message,
					defaultMessage: 'Expected an object.',
				}))
			}

			let issues: AnyExecutionIssue[] | undefined
			let output: Record<PropertyKey, any> | undefined = {}

			for (let i = 0; i < keysLen; i++) {
				const meta = propsMeta[i]!
				const key = meta.key
				if (!Object.hasOwn(value, key)) {
					if (meta.isOptional) {
						if (output != null)
							setOutputValue(output, key, undefined)
						continue
					}
					issues = appendMissingKey(key, issues)
					output = undefined
					if (!collectAllIssues)
						return failure(issues)
					continue
				}

				const result = meta.execute(getOwnValue(value, key))
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
	},
})
