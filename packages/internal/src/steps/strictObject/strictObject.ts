import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, MessageHandler, Next, OperationMode, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, IsExactlyAnyOrUnknown, Simplify, ValueOf } from '../../shared'
import { implStepPlugin } from '../../core'
import { hasInternalIssue } from '../../core/core'
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
					message?: MessageHandler<Internal.Issue<NoInfer<S>>>,
				) => Next<{
					operationMode: Internal.OpMode<NoInfer<S>>
					output: Internal.Output<NoInfer<S>>
					issue: Internal.Issue<NoInfer<S>>
				}, this['CurrentValchecker']>
				: never
			: never
	>
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
		params: [struct, message],
	}) => {
		const keys = Reflect.ownKeys(struct)
			.filter(key => Object.prototype.propertyIsEnumerable.call(struct, key))
		const keysLen = keys.length
		const knownKeysSet = new Set<PropertyKey>(keys)
		const propsMeta: Array<{ key: PropertyKey, isOptional: boolean, execute: Use<Valchecker>['~execute'] }> = []

		for (let i = 0; i < keysLen; i++) {
			const key = keys[i]!
			const prop = struct[key]!
			const isOptional = Array.isArray(prop)
			const schema = isOptional ? prop[0]! : prop
			propsMeta.push({ key, isOptional, execute: schema['~execute'] })
		}

		addSuccessStep((value) => {
			if (typeof value !== 'object' || value == null || Array.isArray(value)) {
				return failure(createIssue({
					code: 'strictObject:expected_object',
					payload: { value },
					customMessage: message,
					defaultMessage: 'Expected an object.',
				}))
			}

			const issues: AnyExecutionIssue[] = []
			const output: Record<PropertyKey, any> = {}

			const ownKeys = Reflect.ownKeys(value)
				.filter(key => Object.prototype.propertyIsEnumerable.call(value, key))
			const unknownKeys: PropertyKey[] = []
			for (let i = 0; i < ownKeys.length; i++) {
				const key = ownKeys[i]!
				if (!knownKeysSet.has(key))
					unknownKeys.push(key)
			}
			if (unknownKeys.length > 0) {
				issues.push(createIssue({
					code: 'strictObject:unexpected_keys',
					payload: { keys: unknownKeys, expectedKeys: [...keys] },
					customMessage: message,
					defaultMessage: 'Unexpected object keys found.',
				}))
			}

			const collectResult = (result: ExecutionResult, key: PropertyKey): boolean => {
				if (isFailure(result)) {
					for (const issue of result.issues)
						issues.push(prependIssuePath(issue, [key], message))
					return hasInternalIssue(result.issues)
				}
				setOutputValue(output, key, result.value)
				return false
			}

			const addMissingIssue = (key: PropertyKey): void => {
				issues.push(createIssue({
					code: 'strictObject:missing_key',
					payload: { key },
					path: [key],
					customMessage: message,
					defaultMessage: 'Missing required object key.',
				}))
			}

			const continueAsync = async (startIndex: number, firstResult: PromiseLike<ExecutionResult>) => {
				for (let i = startIndex; i < keysLen; i++) {
					const { key, isOptional, execute } = propsMeta[i]!
					let result: ExecutionResult
					if (i === startIndex) {
						result = await firstResult
					}
					else if (!Object.hasOwn(value, key)) {
						if (isOptional)
							setOutputValue(output, key, undefined)
						else
							addMissingIssue(key)
						continue
					}
					else {
						result = await execute(getOwnValue(value, key))
					}

					if (collectResult(result, key))
						return failure(issues)
				}
				return issues.length > 0 ? failure(issues) : success(output)
			}

			for (let i = 0; i < keysLen; i++) {
				const { key, isOptional, execute } = propsMeta[i]!
				if (!Object.hasOwn(value, key)) {
					if (isOptional)
						setOutputValue(output, key, undefined)
					else
						addMissingIssue(key)
					continue
				}

				const result = execute(getOwnValue(value, key))
				if (isPromiseLike(result))
					return continueAsync(i, result)
				if (collectResult(result, key))
					return failure(issues)
			}

			return issues.length > 0 ? failure(issues) : success(output)
		})
	},
})
