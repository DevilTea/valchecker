import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferAsync, InferIssue, InferOutput, MessageHandler, Next, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, IsExactlyAnyOrUnknown, Simplify, ValueOf } from '../../shared'
import { implStepPlugin } from '../../core'
import { Pipe } from '../../shared'

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

			const knownKeys = new Set(Reflect.ownKeys(struct))
			const pipe = new Pipe<void>()
			const issues: ExecutionIssue<any, any>[] = []
			const output: Record<PropertyKey, any> = Object.defineProperties(
				{},
				Object.getOwnPropertyDescriptors(value),
			)

			const processPropResult = (result: ExecutionResult, key: string | symbol) => {
				if (isFailure(result)) {
					issues.push(...result.issues.map(issue => prependIssuePath(issue, [key])))
					return
				}
				output[key] = result.value
			}

			for (const key of knownKeys) {
				const isOptional = Array.isArray(struct[key]!)
				const propSchema = Array.isArray(struct[key]!) ? struct[key]![0]! : struct[key]!
				const propValue = (value as any)[key]
				pipe.add(() => {
					const propResult = (isOptional && propValue === void 0)
						? success(propValue)
						: propSchema['~execute'](propValue)
					return propResult instanceof Promise
						? propResult.then(r => processPropResult(r, key))
						: processPropResult(propResult, key)
				})
			}

			const processResult = () => issues.length > 0 ? failure(issues) : success(output)
			const result = pipe.exec()
			return result instanceof Promise
				? result.then(processResult)
				: processResult()
		})
	},
})
