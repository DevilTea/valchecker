import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferIssue, InferOperationMode, InferOutput, MessageHandler, Next, OperationMode, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, IsExactlyAnyOrUnknown, Simplify, ValueOf } from '../../shared'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Struct = Record<string, Use<Valchecker> | [optional: Use<Valchecker>]>

	export type Async<
		S extends Struct,
	> = ValueOf<{
		[K in keyof S]: S[K] extends Use<Valchecker>
			? InferOperationMode<S[K]>
			: S[K] extends [optional: Use<Valchecker>]
				? InferOperationMode<S[K][0]>
				: never
	}> extends infer M extends OperationMode
		? 'async' extends M
			? 'async'
			: 'maybe-async' extends M
				? 'maybe-async'
				: 'sync'
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
							async: Internal.Async<NoInfer<S>>
							output: Internal.Output<NoInfer<S>>
							issue: Internal.Issue<NoInfer<S>>
						},
						this['CurrentValchecker']
					>
				:	never
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const looseObject = implStepPlugin<PluginDef>({
	looseObject: ({
		utils: { addSuccessStep, success, createIssue, failure, isFailure, prependIssuePath },
		params: [struct, message],
	}) => {
		// Pre-compute metadata for each property to avoid repeated lookups
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
			const output: Record<string, any> = Object.defineProperties(
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
				const { key, isOptional, execute } = propsMeta[i]!
				const propValue = (value as any)[key]

				const propResult = (isOptional && propValue === void 0)
					? success(propValue)
					: execute(propValue)

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
									: nextMeta.execute(nextPropValue),
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
