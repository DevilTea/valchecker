import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferIssue, InferOperationMode, InferOutput, MessageHandler, Next, OperationMode, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, IsExactlyAnyOrUnknown, ValueOf } from '../../shared'
import { implStepPlugin } from '../../core'

function canonicalObjectKey(key: PropertyKey): string | symbol {
	return typeof key === 'symbol' ? key : String(key)
}

declare namespace Internal {
	export type Options = Record<PropertyKey, Use<Valchecker>>
	type Modes<O extends Options> = ValueOf<{ [K in keyof O]: InferOperationMode<O[K]> }>
	export type OpMode<O extends Options> = Modes<O> extends infer M extends OperationMode
		? IsEqual<M, 'sync'> extends true ? 'sync' : 'maybe-async'
		: never
	export type Output<O extends Options> = ValueOf<{ [K in keyof O]: InferOutput<O[K]> }>
	export type ChildIssue<O extends Options> = ValueOf<{ [K in keyof O]: InferIssue<O[K]> }>
	export type SelfIssue
		= | ExecutionIssue<'variant:expected_object', { value: unknown }>
			| ExecutionIssue<'variant:invalid_discriminator', { value: object, discriminator: PropertyKey, received: unknown, expected: PropertyKey[] }>
	export type Issue<O extends Options = Options> = SelfIssue | ChildIssue<O>
}

type Meta = DefineStepMethodMeta<{
	Name: 'variant'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.SelfIssue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * Selects one schema from an explicit discriminator-to-schema map and executes only that branch.
	 * Option keys and discriminator values use JavaScript property-key semantics.
	 *
	 * @example `v.variant('type', { circle: circleSchema, square: squareSchema })`
	 * @issue `variant:expected_object`
	 * @issue `variant:invalid_discriminator`
	 */
	variant: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				? <const D extends PropertyKey, const O extends Internal.Options>(discriminator: D, options: keyof O extends never ? never : O, message?: MessageHandler<Internal.Issue<O>>) => Next<{
					operationMode: Internal.OpMode<O>
					output: Internal.Output<O>
					issue: Internal.Issue<O>
				}, this['CurrentValchecker']>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const variant = implStepPlugin<PluginDef>({
	variant: ({
		utils: { addSuccessStep, createIssue, failure },
		params: [discriminator, options, message],
	}) => {
		const optionKeys = Reflect.ownKeys(options)
		const executors = new Map<string | symbol, Use<Valchecker>['~execute']>()
		for (const key of optionKeys)
			executors.set(canonicalObjectKey(key), options[key]!['~execute'])

		addSuccessStep((value) => {
			if (typeof value !== 'object' || value === null || Array.isArray(value)) {
				return failure(createIssue({
					code: 'variant:expected_object',
					payload: { value },
					customMessage: message,
					defaultMessage: 'Expected an object for variant validation.',
				}))
			}
			const received = Object.hasOwn(value, discriminator) ? Reflect.get(value, discriminator) : undefined
			const execute = (typeof received === 'string' || typeof received === 'number' || typeof received === 'symbol')
				? executors.get(canonicalObjectKey(received))
				: undefined
			if (execute === undefined) {
				return failure(createIssue({
					code: 'variant:invalid_discriminator',
					payload: { value, discriminator, received, expected: optionKeys },
					path: [discriminator],
					customMessage: message,
					defaultMessage: `Expected discriminator "${String(discriminator)}" to match a configured variant.`,
				}))
			}
			return execute(value)
		})
	},
})
