import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionFailureResult, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, Next, OperationMode, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, UnionToIntersection } from '../../shared'
import { implStepPlugin } from '../../core'
import { isPromiseLike } from '../../shared'

declare namespace Internal {
	export type Branches = [Use<Valchecker>, ...Use<Valchecker>[]]

	export type OpMode<B extends Branches> = (
		B[number] extends infer S
			? S extends Use<Valchecker>
				? InferOperationMode<S>
				: never
			: never
	) extends infer M extends OperationMode
		? IsEqual<M, 'sync'> extends true
			? 'sync'
			: 'maybe-async'
		: never

	export type Output<B extends Branches> = UnionToIntersection<B[number] extends infer S
		? S extends Use<Valchecker>
			? InferOutput<S>
			: never
		: never>

	export type ConflictIssue = ExecutionIssue<'intersection:conflicting_outputs', { outputs: unknown[] }>

	export type Issue<B extends Branches> = ConflictIssue | (B[number] extends infer S
		? S extends Use<Valchecker>
			? InferIssue<S>
			: never
		: never)
}

type Meta = DefineStepMethodMeta<{
	Name: 'intersection'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.ConflictIssue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value passes all provided branches and combines their outputs.
	 * Equal outputs are preserved. Compatible plain-object outputs are recursively merged,
	 * including enumerable symbol keys. Shared references and cycles must have compatible
	 * topology across branch outputs. Non-plain objects must be the same reference;
	 * otherwise an `intersection:conflicting_outputs` issue is returned.
	 *
	 * Async branches are started in parallel after the first async result is encountered.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, intersection, string, min } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [intersection, string, min] })
	 * const schema = v.intersection([v.string(), v.string().min(5)])
	 * const result = schema.execute('hello')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'intersection:conflicting_outputs'`: Successful branch outputs cannot be combined.
	 * - Issues from the branches.
	 */
	intersection: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			?	<B extends [Use<Valchecker>, ...Use<Valchecker>[]]>(
					branches: B,
				) => Next<
					{
						operationMode: Internal.OpMode<B>
						output: Internal.Output<B>
						issue: Internal.Issue<B>
					},
					this['CurrentValchecker']
				>
			: never
	>
}

type MergeResult
	= | { ok: true, value: unknown }
		| { ok: false }

interface PairingContext {
	leftPartners: WeakMap<object, object>
	rightPartners: WeakMap<object, object>
	visitedPairs: WeakMap<object, WeakSet<object>>
	properties: WeakMap<object, Map<PropertyKey, unknown>>
}

interface MergeContext extends PairingContext {
	outputs: WeakMap<object, Record<PropertyKey, unknown>>
	mergedPairs: WeakMap<object, WeakSet<object>>
}

type MergeSide = 'left' | 'right'

/* @__NO_SIDE_EFFECTS__ */
function isPlainObject(value: unknown): value is Record<PropertyKey, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value))
		return false
	const prototype = Object.getPrototypeOf(value)
	return prototype === Object.prototype || prototype === null
}

function enumerableOwnProperties(
	value: Record<PropertyKey, unknown>,
	context: PairingContext,
): Map<PropertyKey, unknown> {
	const existing = context.properties.get(value)
	if (existing != null)
		return existing

	const properties = new Map<PropertyKey, unknown>()
	for (const key of Reflect.ownKeys(value)) {
		if (Object.prototype.propertyIsEnumerable.call(value, key))
			properties.set(key, value[key])
	}
	context.properties.set(value, properties)
	return properties
}

function defineEnumerableValue(target: Record<PropertyKey, unknown>, key: PropertyKey, value: unknown): void {
	Object.defineProperty(target, key, {
		configurable: true,
		enumerable: true,
		value,
		writable: true,
	})
}

function hasPair(
	pairs: WeakMap<object, WeakSet<object>>,
	left: object,
	right: object,
): boolean {
	return pairs.get(left)?.has(right) === true
}

function markPair(
	pairs: WeakMap<object, WeakSet<object>>,
	left: object,
	right: object,
): void {
	let rights = pairs.get(left)
	if (rights == null) {
		rights = new WeakSet()
		pairs.set(left, rights)
	}
	rights.add(right)
}

function registerPartners(left: object, right: object, context: PairingContext): boolean {
	const mappedRight = context.leftPartners.get(left)
	if (mappedRight !== undefined && mappedRight !== right)
		return false

	const mappedLeft = context.rightPartners.get(right)
	if (mappedLeft !== undefined && mappedLeft !== left)
		return false

	context.leftPartners.set(left, right)
	context.rightPartners.set(right, left)
	return true
}

function discoverCompatibility(
	left: unknown,
	right: unknown,
	context: PairingContext,
): boolean {
	if (!isPlainObject(left) || !isPlainObject(right))
		return Object.is(left, right)
	if (!registerPartners(left, right, context))
		return false
	if (hasPair(context.visitedPairs, left, right))
		return true
	markPair(context.visitedPairs, left, right)

	const leftProperties = enumerableOwnProperties(left, context)
	const rightProperties = enumerableOwnProperties(right, context)
	for (const [key, leftValue] of leftProperties) {
		if (rightProperties.has(key)
			&& !discoverCompatibility(leftValue, rightProperties.get(key), context))
			return false
	}
	return true
}

function cloneValue(
	value: unknown,
	side: MergeSide,
	context: MergeContext,
): MergeResult {
	if (!isPlainObject(value))
		return { ok: true, value }

	const existing = context.outputs.get(value)
	if (existing != null)
		return { ok: true, value: existing }

	const partner = side === 'left'
		? context.leftPartners.get(value)
		: context.rightPartners.get(value)
	if (partner != null) {
		return side === 'left'
			? mergePlainObjects(value, partner as Record<PropertyKey, unknown>, context)
			: mergePlainObjects(partner as Record<PropertyKey, unknown>, value, context)
	}

	const output = Object.create(Object.getPrototypeOf(value)) as Record<PropertyKey, unknown>
	context.outputs.set(value, output)
	for (const [key, propertyValue] of enumerableOwnProperties(value, context)) {
		const cloned = cloneValue(propertyValue, side, context)
		if (!cloned.ok)
			return cloned
		defineEnumerableValue(output, key, cloned.value)
	}
	return { ok: true, value: output }
}

function mergePlainObjects(
	left: Record<PropertyKey, unknown>,
	right: Record<PropertyKey, unknown>,
	context: MergeContext,
): MergeResult {
	if (left === right) {
		const existing = context.outputs.get(left)
		if (existing != null && existing !== left)
			return { ok: false }
		context.outputs.set(left, left)
		markPair(context.mergedPairs, left, right)
		return { ok: true, value: left }
	}

	const leftOutput = context.outputs.get(left)
	const rightOutput = context.outputs.get(right)
	if (leftOutput != null && rightOutput != null && leftOutput !== rightOutput)
		return { ok: false }

	const output = leftOutput
		?? rightOutput
		?? Object.create(Object.getPrototypeOf(left)) as Record<PropertyKey, unknown>
	context.outputs.set(left, output)
	context.outputs.set(right, output)

	if (hasPair(context.mergedPairs, left, right))
		return { ok: true, value: output }
	markPair(context.mergedPairs, left, right)

	const leftProperties = enumerableOwnProperties(left, context)
	const rightProperties = enumerableOwnProperties(right, context)

	for (const [key, leftValue] of leftProperties) {
		if (!rightProperties.has(key))
			continue
		const merged = mergeValues(leftValue, rightProperties.get(key), context)
		if (!merged.ok)
			return merged
		defineEnumerableValue(output, key, merged.value)
	}

	for (const [key, leftValue] of leftProperties) {
		if (rightProperties.has(key))
			continue
		const cloned = cloneValue(leftValue, 'left', context)
		if (!cloned.ok)
			return cloned
		defineEnumerableValue(output, key, cloned.value)
	}

	for (const [key, rightValue] of rightProperties) {
		if (leftProperties.has(key))
			continue
		const cloned = cloneValue(rightValue, 'right', context)
		if (!cloned.ok)
			return cloned
		defineEnumerableValue(output, key, cloned.value)
	}

	return { ok: true, value: output }
}

function mergeValues(
	left: unknown,
	right: unknown,
	context: MergeContext,
): MergeResult {
	if (isPlainObject(left) && isPlainObject(right))
		return mergePlainObjects(left, right, context)
	return Object.is(left, right)
		? { ok: true, value: left }
		: { ok: false }
}

function mergeOutputGraphs(left: unknown, right: unknown): MergeResult {
	const pairingContext: PairingContext = {
		leftPartners: new WeakMap(),
		rightPartners: new WeakMap(),
		visitedPairs: new WeakMap(),
		properties: new WeakMap(),
	}
	if (!discoverCompatibility(left, right, pairingContext))
		return { ok: false }

	return mergeValues(left, right, {
		...pairingContext,
		outputs: new WeakMap(),
		mergedPairs: new WeakMap(),
	})
}

/* @__NO_SIDE_EFFECTS__ */
export const intersection = implStepPlugin<PluginDef>({
	intersection: ({
		utils: { addSuccessStep, success, failure, isFailure, createIssue },
		params: [branches],
	}) => {
		const branchExecutors = branches.map(branch => branch['~execute'])
		const len = branchExecutors.length

		addSuccessStep((value) => {
			const outputs: unknown[] = []

			const conflict = () => failure(createIssue({
				code: 'intersection:conflicting_outputs',
				payload: { outputs },
				defaultMessage: 'Intersection branch outputs conflict.',
			}))

			const mergeOutputs = () => {
				if (outputs.length === 0)
					return success(value)

				let output = outputs[0]
				for (let i = 1; i < outputs.length; i++) {
					const merged = mergeOutputGraphs(output, outputs[i])
					if (!merged.ok)
						return conflict()
					output = merged.value
				}
				return success(output)
			}

			const processResults = (results: ExecutionResult[]) => {
				for (const result of results) {
					if (isFailure(result))
						return result as ExecutionFailureResult<ExecutionIssue>
					outputs.push(result.value)
				}
				return mergeOutputs()
			}

			for (let i = 0; i < len; i++) {
				const branchResult = branchExecutors[i]!(value)
				if (isPromiseLike(branchResult)) {
					const pending: Promise<ExecutionResult>[] = [Promise.resolve(branchResult)]
					for (let j = i + 1; j < len; j++)
						pending.push(Promise.resolve(branchExecutors[j]!(value)))
					return Promise.all(pending)
						.then(processResults)
				}
				if (isFailure(branchResult))
					return branchResult
				outputs.push(branchResult.value)
			}

			return mergeOutputs()
		})
	},
})
