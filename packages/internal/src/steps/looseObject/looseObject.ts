import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferIssue, InferOperationMode, InferOutput, MessageHandler, Next, OperationMode, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, IsExactlyAnyOrUnknown, Simplify, ValueOf } from '../../shared'
import { implStepPlugin } from '../../core'
import { isPromiseLike } from '../../shared'

declare namespace Internal {
	export type Struct = Record<string, Use<Valchecker> | [optional: Use<Valchecker>]>

	export type OpMode<
		S extends Struct,
	> = ValueOf<{
		[K in keyof S]: S[K] extends Use<Valchecker>
			? InferOperationMode<S[K]>
			: S[K] extends [optional: Use<Valchecker>]
				? InferOperationMode<S[K][0]>
				: never
	}> extends infer M
		? [M] extends [never]
				? 'sync'
				: M extends OperationMode
					? IsEqual<M, 'sync'> extends true
						? 'sync'
						: 'maybe-async'
					: never
		: never

	export type Output<
		S extends Struct,
	> = Simplify<
		{
			[K in keyof S as S[K] extends Use<Valchecker> ? K : never]: S[K] extends Use<Valchecker> ? InferOutput<S[K]> : never
		} & {
			[K in keyof S as S[K] extends [optional: Use<Valchecker>] ? K : never]?: S[K] extends [optional: Use<Valchecker>] ? InferOutput<S[K][0]> : never
		} & Record<PropertyKey, unknown>
	>

	export type Issue<S extends Struct = never>
		= | ExecutionIssue<'looseObject:expected_object', { value: unknown }>
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
	 * Checks that the value is an object and validates the specified properties, allowing extra keys.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, looseObject, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [looseObject, string] })
	 * const schema = v.looseObject({ name: v.string() })
	 * const result = schema.execute({ name: 'John', age: 30 })
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'looseObject:expected_object'`: The value is not an object.
	 * - Issues from the property validations.
	 */
	looseObject: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			?	IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				?	<S extends Internal.Struct>(
						struct: S,
						message?: MessageHandler<Internal.Issue<NoInfer<S>>>,
					) => Next<
						{
							operationMode: Internal.OpMode<NoInfer<S>>
							output: Internal.Output<NoInfer<S>>
							issue: Internal.Issue<NoInfer<S>>
						},
						this['CurrentValchecker']
					>
				:	never
			:	never
	>
}

function getOwnValue(value: object, key: string): any {
	return Object.hasOwn(value, key)
		? (value as Record<string, any>)[key]
		: undefined
}

function setOutputValue(output: Record<string, any>, key: string, value: unknown): void {
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
		const keys = Object.keys(struct)
		const keysLen = keys.length
		const propsMeta: Array<{ key: string, isOptional: boolean, execute: Use<Valchecker>['~execute'] }> = []

		for (let i = 0; i < keysLen; i++) {
			const key = keys[i]!
			const prop = struct[key]!
			const isOptional = Array.isArray(prop)
			const schema = isOptional ? prop[0]! : prop
			propsMeta.push({ key, isOptional, execute: schema['~execute'] })
		}

		addSuccessStep((value) => {
			if (typeof value !== 'object' || value == null || Array.isArray(value)) {
				return failure(
					createIssue({
						code: 'looseObject:expected_object',
						payload: { value },
						customMessage: message,
						defaultMessage: 'Expected an object.',
					}),
				)
			}

			const issues: ExecutionIssue<any, any>[] = []
			const descriptors = Object.getOwnPropertyDescriptors(value)
			for (const key of keys)
				delete descriptors[key]
			const output: Record<string, any> = Object.defineProperties({}, descriptors)

			for (let i = 0; i < keysLen; i++) {
				const { key, isOptional, execute } = propsMeta[i]!
				const propValue = getOwnValue(value, key)
				const propResult = (isOptional && propValue === void 0)
					? success(propValue)
					: execute(propValue)

				if (isPromiseLike(propResult)) {
					let chain = Promise.resolve(propResult)
						.then((r) => {
							if (isFailure(r)) {
								for (const issue of r.issues)
									issues.push(prependIssuePath(issue, [key]))
							}
							else {
								setOutputValue(output, key, r.value)
							}
						})

					for (let j = i + 1; j < keysLen; j++) {
						const nextMeta = propsMeta[j]!
						const nextPropValue = getOwnValue(value, nextMeta.key)
						chain = chain.then(() => Promise.resolve(
							(nextMeta.isOptional && nextPropValue === void 0)
								? success(nextPropValue)
								: nextMeta.execute(nextPropValue),
						)
							.then((r) => {
								if (isFailure(r)) {
									for (const issue of r.issues)
										issues.push(prependIssuePath(issue, [nextMeta.key]))
								}
								else {
									setOutputValue(output, nextMeta.key, r.value)
								}
							}))
					}

					return chain.then(() => issues.length > 0 ? failure(issues) : success(output))
				}

				if (isFailure(propResult)) {
					for (const issue of propResult.issues)
						issues.push(prependIssuePath(issue, [key]))
				}
				else {
					setOutputValue(output, key, propResult.value)
				}
			}

			return issues.length > 0 ? failure(issues) : success(output)
		})
	},
})
