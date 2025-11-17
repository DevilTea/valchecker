import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferAsync, InferIssue, InferOutput, MessageHandler, Next, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, IsExactlyAnyOrUnknown, Simplify, ValueOf } from '../../shared'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Struct = Record<PropertyKey, Use<Valchecker> | [optional: Use<Valchecker>]>

	export type Async<
		S extends Struct,
	> = ValueOf<{
		[K in keyof S]: S[K] extends Use<Valchecker>
			? InferAsync<S[K]>
			: S[K] extends [optional: Use<Valchecker>]
				? InferAsync<S[K][0]>
				: never
	}> extends false
		? false
		: true

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
	=	| ExecutionIssue<'looseObject:expected_object', { value: unknown }>
		| (
			IsEqual<Struct, never> extends true
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
	ExpectedThis: DefineExpectedValchecker
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
		this['This'] extends Meta['ExpectedThis']
			?	IsExactlyAnyOrUnknown<InferOutput<this['This']>> extends true
				?	<S extends Internal.Struct>(
						struct: S,
						message?: MessageHandler<Internal.Issue<NoInfer<S>>>
					) => Next<
						{
							async: Internal.Async<NoInfer<S>>
							output: Internal.Output<NoInfer<S>>
							issue: Internal.Issue<NoInfer<S>>
						},
						this['This']
					>
				:	never
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const looseObject = implStepPlugin<PluginDef>({
	looseObject: ({
		utils: { addSuccessStep, success, resolveMessage, failure, isFailure, prependIssuePath },
		params: [struct, message],
	}) => {
		// Pre-compute metadata for each property to avoid repeated lookups
		const keys = Reflect.ownKeys(struct)
		const keysLen = keys.length
		const propsMeta: Array<{ key: PropertyKey, isOptional: boolean, schema: Use<Valchecker> }> = []

		for (let i = 0; i < keysLen; i++) {
			const key = keys[i]!
			const prop = struct[key]!
			const isOptional = Array.isArray(prop)
			const schema = isOptional ? prop[0]! : prop
			propsMeta.push({ key, isOptional, schema })
		}

		addSuccessStep((value) => {
			if (typeof value !== 'object' || value == null || Array.isArray(value)) {
				return failure({
					code: 'looseObject:expected_object',
					payload: { value },
					message: resolveMessage(
						{
							code: 'looseObject:expected_object',
							payload: { value },
						},
						message,
						'Expected an object.',
					),
				})
			}

			const issues: ExecutionIssue<any, any>[] = []
			const output: Record<PropertyKey, any> = Object.defineProperties(
				{},
				Object.getOwnPropertyDescriptors(value),
			)

			// Inline processPropResult for better performance
			// Process properties synchronously until we hit async
			let isAsync = false
			for (let i = 0; i < keysLen; i++) {
				if (isAsync) {
					// Already in async mode, skip
					continue
				}
				const { key, isOptional, schema } = propsMeta[i]!
				const propValue = (value as any)[key]

				const propResult = (isOptional && propValue === void 0)
					? success(propValue)
					: schema['~execute'](propValue)

				if (propResult instanceof Promise) {
					isAsync = true
					// Hit async, chain remaining properties
					let chain = propResult.then((r) => {
						if (isFailure(r)) {
							for (const issue of r.issues!) {
								issues.push(prependIssuePath(issue, [key]))
							}
						}
						else {
							output[key] = r.value!
						}
					})

					for (let j = i + 1; j < keysLen; j++) {
						const nextMeta = propsMeta[j]!
						const nextPropValue = (value as any)[nextMeta.key]

						chain = chain.then((): void | Promise<void> => {
							return Promise.resolve(
								(nextMeta.isOptional && nextPropValue === void 0)
									? success(nextPropValue)
									: nextMeta.schema['~execute'](nextPropValue),
							)
								.then((r) => {
									if (isFailure(r)) {
										for (const issue of r.issues!) {
											issues.push(prependIssuePath(issue, [nextMeta.key]))
										}
									}
									else {
										output[nextMeta.key] = r.value!
									}
								})
						})
					}

					return chain.then(() => issues.length > 0 ? failure(issues) : success(output))
				}

				if (isFailure(propResult)) {
					for (const issue of propResult.issues!) {
						issues.push(prependIssuePath(issue, [key]))
					}
				}
				else {
					output[key] = propResult.value!
				}
			}

			return issues.length > 0 ? failure(issues) : success(output)
		})
	},
})
