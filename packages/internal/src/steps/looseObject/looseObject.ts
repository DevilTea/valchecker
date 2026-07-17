import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, MessageHandler, Next, OperationMode, TStepPluginDef, Use, Valchecker } from '../../core'
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
		} & Record<PropertyKey, unknown>
	>

	export type Issue<S extends Struct = never>
		= | ExecutionIssue<'looseObject:expected_object', { value: unknown }>
			| ExecutionIssue<'looseObject:missing_key', { key: PropertyKey }>
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
	Name: 'looseObject'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is an object, validates declared properties, and preserves extra own properties.
	 *
	 * Required keys that are not own properties produce `'looseObject:missing_key'`.
	 * An own property whose value is `undefined` is still validated by its child schema.
	 */
	looseObject: DefineStepMethod<
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
export const looseObject = implStepPlugin<PluginDef>({
	looseObject: ({
		utils: { addSuccessStep, success, createIssue, failure, isFailure, prependIssuePath },
		params: [struct, message],
	}) => {
		const keys: PropertyKey[] = Object.keys(struct)
		const symbols = Object.getOwnPropertySymbols(struct)
		for (let i = 0; i < symbols.length; i++) {
			const key = symbols[i]!
			if (Object.prototype.propertyIsEnumerable.call(struct, key))
				keys.push(key)
		}
		const keysLen = keys.length
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
					code: 'looseObject:expected_object',
					payload: { value },
					customMessage: message,
					defaultMessage: 'Expected an object.',
				}))
			}

			const issues: AnyExecutionIssue[] = []
			const descriptors = Object.getOwnPropertyDescriptors(value)
			for (let i = 0; i < keysLen; i++)
				delete descriptors[keys[i] as keyof typeof descriptors]
			const output: Record<PropertyKey, any> = Object.defineProperties({}, descriptors)

			for (let i = 0; i < keysLen; i++) {
				const { key, isOptional, execute } = propsMeta[i]!
				if (!Object.hasOwn(value, key)) {
					if (isOptional)
						setOutputValue(output, key, undefined)
					else {
						issues.push(createIssue({
							code: 'looseObject:missing_key',
							payload: { key },
							path: [key],
							customMessage: message,
							defaultMessage: 'Missing required object key.',
						}))
					}
					continue
				}

				const result = execute(getOwnValue(value, key))
				if (isPromiseLike(result)) {
					return (async () => {
						for (let j = i; j < keysLen; j++) {
							const meta = propsMeta[j]!
							let resolved: ExecutionResult
							if (j === i) {
								resolved = await result
							}
							else if (!Object.hasOwn(value, meta.key)) {
								if (meta.isOptional)
									setOutputValue(output, meta.key, undefined)
								else {
									issues.push(createIssue({
										code: 'looseObject:missing_key',
										payload: { key: meta.key },
										path: [meta.key],
										customMessage: message,
										defaultMessage: 'Missing required object key.',
									}))
								}
								continue
							}
							else {
								resolved = await meta.execute(getOwnValue(value, meta.key))
							}

							if (isFailure(resolved)) {
								let hasInternal = false
								for (const issue of resolved.issues) {
									if (issue.category === 'internal')
										hasInternal = true
									issues.push(prependIssuePath(issue, [meta.key], message))
								}
								if (hasInternal)
									return failure(issues)
							}
							else {
								setOutputValue(output, meta.key, resolved.value)
							}
						}
						return issues.length > 0 ? failure(issues) : success(output)
					})()
				}

				if (isFailure(result)) {
					let hasInternal = false
					for (const issue of result.issues) {
						if (issue.category === 'internal')
							hasInternal = true
						issues.push(prependIssuePath(issue, [key], message))
					}
					if (hasInternal)
						return failure(issues)
				}
				else {
					setOutputValue(output, key, result.value)
				}
			}

			return issues.length > 0 ? failure(issues) : success(output)
		})
	},
})
