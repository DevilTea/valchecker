import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, Next, OperationMode, StepOptions, TStepPluginDef, Use, Valchecker } from '../../core'
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
		= | ExecutionIssue<'strictObject:expected_object', { value: unknown }>
			| ExecutionIssue<'strictObject:missing_key', { key: PropertyKey }>
			| ExecutionIssue<'strictObject:unexpected_keys', { keys: PropertyKey[], expectedKeys: PropertyKey[] }>
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
	Name: 'strictObject'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is an object. Extra keys are rejected.
	 *
	 * Required keys that are not own properties produce `'strictObject:missing_key'`.
	 * An own property whose value is `undefined` is still validated by its child schema.
	 */
	strictObject: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				? <S extends Internal.Struct>(
						struct: S,
						options?: StepOptions<Internal.Issue<NoInfer<S>>>,
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
export const strictObject = implStepPlugin<PluginDef>({
	strictObject: ({
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
		const knownKeysSet = new Set<PropertyKey>(keys)
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

		const continueAsync = async (
			value: object,
			startIndex: number,
			firstResult: PromiseLike<ExecutionResult>,
			output: Record<PropertyKey, any> | undefined,
			issues: AnyExecutionIssue[] | undefined,
		): Promise<ExecutionResult> => {
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
					}
					else {
						(issues ??= []).push(createIssue({
							code: 'strictObject:missing_key',
							payload: { key: meta.key },
							path: [meta.key],
							customMessage: options?.message,
							defaultMessage: 'Missing required object key.',
						}))
						output = undefined
					}
					continue
				}
				else {
					result = await meta.execute(getOwnValue(value, meta.key))
				}

				if (isFailure(result)) {
					let hasInternal = false
					const target = issues ??= []
					output = undefined
					for (const issue of result.issues) {
						if (issue.category === 'internal')
							hasInternal = true
						target.push(prependIssuePath(issue, [meta.key], options?.message))
					}
					if (hasInternal)
						return failure(target)
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
					code: 'strictObject:expected_object',
					payload: { value },
					customMessage: options?.message,
					defaultMessage: 'Expected an object.',
				}))
			}

			const ownKeys: PropertyKey[] = Object.keys(value)
			const ownSymbols = Object.getOwnPropertySymbols(value)
			for (let i = 0; i < ownSymbols.length; i++) {
				const key = ownSymbols[i]!
				if (Object.prototype.propertyIsEnumerable.call(value, key))
					ownKeys.push(key)
			}
			let unknownKeys: PropertyKey[] | undefined
			for (let i = 0; i < ownKeys.length; i++) {
				const key = ownKeys[i]!
				if (!knownKeysSet.has(key))
					(unknownKeys ??= []).push(key)
			}

			let issues: AnyExecutionIssue[] | undefined
			let output: Record<PropertyKey, any> | undefined = {}
			if (unknownKeys != null) {
				issues = [createIssue({
					code: 'strictObject:unexpected_keys',
					payload: { keys: unknownKeys, expectedKeys: [...keys] },
					customMessage: options?.message,
					defaultMessage: 'Unexpected object keys found.',
				})]
				output = undefined
			}

			for (let i = 0; i < keysLen; i++) {
				const meta = propsMeta[i]!
				const key = meta.key
				if (!Object.hasOwn(value, key)) {
					if (meta.isOptional) {
						if (output != null)
							setOutputValue(output, key, undefined)
					}
					else {
						(issues ??= []).push(createIssue({
							code: 'strictObject:missing_key',
							payload: { key },
							path: [key],
							customMessage: options?.message,
							defaultMessage: 'Missing required object key.',
						}))
						output = undefined
					}
					continue
				}

				const result = meta.execute(getOwnValue(value, key))
				if (isPromiseLike(result))
					return continueAsync(value, i, result, output, issues)

				if (isFailure(result)) {
					let hasInternal = false
					const target = issues ??= []
					output = undefined
					for (const issue of result.issues) {
						if (issue.category === 'internal')
							hasInternal = true
						target.push(prependIssuePath(issue, [key], options?.message))
					}
					if (hasInternal)
						return failure(target)
				}
				else if (output != null) {
					setOutputValue(output, key, result.value)
				}
			}

			return issues == null ? success(output!) : failure(issues)
		}, operationMode)
	},
})
