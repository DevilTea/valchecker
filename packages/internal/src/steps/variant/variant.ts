import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, Next, OperationMode, StepOptions, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, IsExactlyAnyOrUnknown, ValueOf } from '../../shared'
import { implStepPlugin } from '../../core'
import { isPromiseLike } from '../../shared'

function canonicalPropertyKey(value: string | number | symbol): string | symbol {
	return typeof value === 'symbol' ? value : String(value)
}

function isValcheckerSchema(value: unknown): value is Use<Valchecker> {
	return (
		typeof value === 'function'
		|| (typeof value === 'object' && value !== null)
	) && typeof Reflect.get(value, '~execute') === 'function'
}

declare namespace Internal {
	export type Variants = Record<PropertyKey, Use<Valchecker>>
	type Modes<V extends Variants> = ValueOf<{ [K in keyof V]: InferOperationMode<V[K]> }>
	export type OpMode<V extends Variants> = Modes<V> extends infer M extends OperationMode
		? IsEqual<M, 'sync'> extends true ? 'sync' : 'maybe-async'
		: never
	export type Output<V extends Variants> = ValueOf<{ [K in keyof V]: InferOutput<V[K]> }>
	export type ChildIssue<V extends Variants> = ValueOf<{ [K in keyof V]: InferIssue<V[K]> }>
	export type ExpectedObjectIssue = ExecutionIssue<'variant:expected_object', { value: unknown }>
	export type InvalidDiscriminatorIssue<D extends PropertyKey = PropertyKey> = ExecutionIssue<
		'variant:invalid_discriminator',
		{
			value: object
			discriminator: D
			received: unknown
			expected: readonly (string | symbol)[]
		}
	>
	export type SelfIssue<D extends PropertyKey = PropertyKey> = ExpectedObjectIssue | InvalidDiscriminatorIssue<D>
	export type Issue<D extends PropertyKey, V extends Variants> = SelfIssue<D> | ChildIssue<V>
	export interface Options<D extends PropertyKey, V extends Variants> extends StepOptions<
		Issue<NoInfer<D>, NoInfer<V>>
	> {
		readonly discriminator: D
		readonly variants: keyof V extends never ? never : V
	}
}

type Meta = DefineStepMethodMeta<{
	Name: 'variant'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.SelfIssue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Selects one schema through an own discriminator property and executes only
	 * that branch. Variant keys use JavaScript property-key canonicalization.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, literal, number, object, variant } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [variant, object, literal, number] })
	 * const schema = v.variant({
	 * 	discriminator: 'type',
	 * 	variants: {
	 * 		circle: v.object({ type: v.literal('circle'), radius: v.number() }),
	 * 		square: v.object({ type: v.literal('square'), size: v.number() }),
	 * 	},
	 * })
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'variant:expected_object'`: The value is not an object.
	 * - `'variant:invalid_discriminator'`: The discriminator property does not match any variant key.
	 */
	variant: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? IsExactlyAnyOrUnknown<InferOutput<This>> extends true
				? <const D extends PropertyKey, const V extends Internal.Variants>(
						options: Internal.Options<D, V>,
					) => Next<{
						operationMode: Internal.OpMode<V>
						output: Internal.Output<V>
						issue: Internal.Issue<D, V>
					}, This>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const variant = implStepPlugin<PluginDef>({
	variant: ({
		utils: { addSuccessStep, appendIssueContext, createIssue, failure, isFailure, prependIssuePath },
		params: [options],
	}) => {
		if (typeof options !== 'object' || options === null || Array.isArray(options))
			throw new TypeError('variant() requires a configuration object.')

		const { discriminator, variants, message } = options
		const discriminatorType = typeof discriminator
		if (discriminatorType !== 'string' && discriminatorType !== 'number' && discriminatorType !== 'symbol')
			throw new TypeError('variant() discriminator must be a property key.')
		if (typeof variants !== 'object' || variants === null || Array.isArray(variants))
			throw new TypeError('variant() variants must be an object.')

		const variantKeys = Reflect.ownKeys(variants)
		if (variantKeys.length === 0)
			throw new TypeError('variant() requires at least one variant.')

		const expected = Object.freeze([...variantKeys])
		const executors = new Map<string | symbol, Use<Valchecker>['~execute']>()
		let operationMode: OperationMode = 'sync'
		for (const key of variantKeys) {
			const schema = Reflect.get(variants, key)
			if (!isValcheckerSchema(schema))
				throw new TypeError(`variant() branch for ${String(key)} must be a Valchecker schema.`)
			executors.set(key, schema['~execute'])
			if (schema['~core']?.operationMode !== 'sync')
				operationMode = 'maybe-async'
		}

		const finishBranch = (
			result: ExecutionResult,
			received: string | number | symbol,
		): ExecutionResult => {
			if (!isFailure(result))
				return result
			const issues: AnyExecutionIssue[] = Array.from({ length: result.issues.length })
			// Deliberately duplicated per-file inline loop: V8 inlines this per-schema loop but not a shared cross-module helper. See architecture.md (extraction measured -12%/-13% on the failure hot path, 2026-07-22).
			for (let index = 0; index < result.issues.length; index++) {
				const scoped = prependIssuePath(result.issues[index]!, [], message)
				issues[index] = appendIssueContext(scoped, {
					type: 'variant',
					discriminator,
					discriminatorValue: received,
				})
			}
			return failure(issues)
		}

		addSuccessStep((value) => {
			if (typeof value !== 'object' || value === null || Array.isArray(value)) {
				return failure(createIssue({
					code: 'variant:expected_object',
					payload: { value },
					customMessage: message,
					defaultMessage: 'Expected an object for variant validation.',
				}))
			}

			const received = Object.hasOwn(value, discriminator)
				? Reflect.get(value, discriminator)
				: undefined
			const receivedType = typeof received
			const execute = receivedType === 'string' || receivedType === 'number' || receivedType === 'symbol'
				? executors.get(canonicalPropertyKey(received as string | number | symbol))
				: undefined

			if (execute === undefined) {
				return failure(createIssue({
					code: 'variant:invalid_discriminator',
					payload: { value, discriminator, received, expected },
					path: [discriminator],
					customMessage: message,
					defaultMessage: `Expected discriminator "${String(discriminator)}" to match a configured variant.`,
				}))
			}

			const result = execute(value)
			if (operationMode === 'sync')
				return finishBranch(result as ExecutionResult, received as string | number | symbol)
			return isPromiseLike(result)
				? Promise.resolve(result)
						.then(resolved => finishBranch(resolved, received as string | number | symbol))
				: finishBranch(result, received as string | number | symbol)
		}, operationMode)
	},
})
