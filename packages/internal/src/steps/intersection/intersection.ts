import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, Next, OperationMode, StructuralStepOptions, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, UnionToIntersection } from '../../shared'
import { implStepPlugin } from '../../core'
import { markIssueSnapshotPayload } from '../../core/core'
import { snapshotMessage } from '../../core/message'
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
		? IsEqual<M, 'sync'> extends true ? 'sync' : 'maybe-async'
		: never

	export type Output<B extends Branches> = UnionToIntersection<B[number] extends infer S
		? S extends Use<Valchecker>
			? InferOutput<S>
			: never
		: never>

	export type ConflictReason
		= | 'different_values'
			| 'different_references'
			| 'incompatible_alias'
			| 'incompatible_cycle'
			| 'incompatible_prototype'

	export type ConflictIssue = ExecutionIssue<'intersection:conflicting_outputs', {
		path: PropertyKey[]
		leftBranch: number
		rightBranch: number
		leftValue: unknown
		rightValue: unknown
		reason: ConflictReason
	}>

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
	 * Checks every branch and recursively merges compatible outputs. A merge
	 * conflict reports the exact graph path, the pair of branch indices, both
	 * conflicting values, and a stable reason code. Branch evaluation stops
	 * after the first issue unless `collectAllIssues` is enabled.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, intersection, number, object, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [object, string, number, intersection] })
	 * const schema = v.intersection([
	 * 	v.object({ id: v.string() }),
	 * 	v.object({ age: v.number() }),
	 * ])
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'intersection:conflicting_outputs'`: Two branch outputs cannot be merged at the reported path.
	 */
	intersection: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? <B extends [Use<Valchecker>, ...Use<Valchecker>[]]>(
					branches: B,
					options?: StructuralStepOptions<Internal.Issue<NoInfer<B>>>,
				) => Next<{
					operationMode: Internal.OpMode<B>
					output: Internal.Output<B>
					issue: Internal.Issue<B>
				}, this['CurrentValchecker']>
			: never
	>
}

interface MergeConflict {
	path: PropertyKey[]
	leftValue: unknown
	rightValue: unknown
	reason: Internal.ConflictReason
}

type MergeResult
	= | { ok: true, value: unknown }
		| { ok: false, conflict: MergeConflict }

type CompatibilityResult
	= | { ok: true }
		| { ok: false, conflict: MergeConflict }

interface PairingContext {
	leftPartners: WeakMap<object, object>
	rightPartners: WeakMap<object, object>
	visitedPairs: WeakMap<object, WeakSet<object>>
	properties: WeakMap<object, Map<PropertyKey, unknown>>
	activeLeft: WeakSet<object>
	activeRight: WeakSet<object>
}

interface MergeContext extends PairingContext {
	outputs: WeakMap<object, Record<PropertyKey, unknown>>
	mergedPairs: WeakMap<object, WeakSet<object>>
}

interface FlatProperties {
	keys: PropertyKey[]
	values: unknown[]
	hasNestedPlainObject: boolean
}

type MergeSide = 'left' | 'right'

/* @__NO_SIDE_EFFECTS__ */
function isObject(value: unknown): value is object {
	return typeof value === 'object' && value !== null
}

/* @__NO_SIDE_EFFECTS__ */
function isPlainObject(value: unknown): value is Record<PropertyKey, unknown> {
	if (!isObject(value) || Array.isArray(value))
		return false
	const prototype = Object.getPrototypeOf(value)
	return prototype === Object.prototype || prototype === null
}

function createConflict(
	path: PropertyKey[],
	leftValue: unknown,
	rightValue: unknown,
	reason: Internal.ConflictReason,
): { ok: false, conflict: MergeConflict } {
	return {
		ok: false,
		conflict: { path, leftValue, rightValue, reason },
	}
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

/**
 * Reads every own enumerable property exactly once, recording whether any value
 * is a nested plain object (which the shallow merge cannot handle, because the
 * general path clones nested objects rather than sharing them).
 *
 * `Object.keys` plus the enumerable own symbols yields the same sequence as
 * `Reflect.ownKeys` filtered by `propertyIsEnumerable`, without allocating a
 * descriptor object per key. Descriptor allocation dominated this path:
 * removing those scans improved the `merge disjoint flat objects` case in
 * `intersection.bench.ts` by about 29% and the cross-library
 * `intersection/valid` scenario by about 26% (2026-07-27).
 *
 * Enumerability is re-checked per key rather than trusted from the initial
 * `Object.keys` snapshot, because a getter invoked during this scan may delete
 * a later key or make it non-enumerable; `enumerableOwnProperties` re-checks
 * the same way, so both paths drop it.
 *
 * The reverse is deliberately not covered: a getter that makes a later
 * NON-enumerable key enumerable mid-scan is invisible here, because
 * `Object.keys` never listed that key, while `enumerableOwnProperties` starts
 * from `Reflect.ownKeys` and would include it. Closing that gap means scanning
 * `Reflect.ownKeys` here too, which measured 464 ns against the 448 ns of the
 * descriptor version this replaced — slower than doing nothing at all
 * (2026-07-27). The shape requires a getter that alters its own object's
 * property attributes while that object is being enumerated.
 *
 * The scan completes even after it finds a nested plain object, so `values` is
 * always the full set the caller can hand to the general path, which therefore
 * never re-reads a property.
 */
function readFlatProperties(value: Record<PropertyKey, unknown>): FlatProperties {
	// The `Object.keys` array is reused as the key list and compacted in place, so
	// the common case where nothing is skipped allocates no extra array.
	const keys: PropertyKey[] = Object.keys(value)
	const values: unknown[] = []
	let hasNestedPlainObject = false
	let kept = 0
	for (let i = 0; i < keys.length; i++) {
		const key = keys[i]!
		if (!Object.prototype.propertyIsEnumerable.call(value, key))
			continue
		const propertyValue = value[key]
		if (isPlainObject(propertyValue))
			hasNestedPlainObject = true
		keys[kept] = key
		kept++
		values.push(propertyValue)
	}
	if (kept !== keys.length)
		keys.length = kept

	const symbols = Object.getOwnPropertySymbols(value)
	for (let i = 0; i < symbols.length; i++) {
		const key = symbols[i]!
		if (!Object.prototype.propertyIsEnumerable.call(value, key))
			continue
		const propertyValue = value[key]
		if (isPlainObject(propertyValue))
			hasNestedPlainObject = true
		keys.push(key)
		values.push(propertyValue)
	}
	return { keys, values, hasNestedPlainObject }
}

function toPropertyMap(flat: FlatProperties): Map<PropertyKey, unknown> {
	const properties = new Map<PropertyKey, unknown>()
	for (let i = 0; i < flat.keys.length; i++)
		properties.set(flat.keys[i]!, flat.values[i])
	return properties
}

function assignFlatProperties(
	target: Record<PropertyKey, unknown>,
	properties: FlatProperties,
): void {
	for (let i = 0; i < properties.keys.length; i++) {
		const key = properties.keys[i]!
		// `__proto__` must become an own data property instead of reassigning the
		// prototype, which plain assignment would do through the inherited setter.
		if (key === '__proto__')
			defineEnumerableValue(target, key, properties.values[i])
		else
			target[key] = properties.values[i]
	}
}

/**
 * Both sides are flat (no nested plain objects), share a prototype, and have
 * disjoint enumerable keys, so a shallow combine is exact.
 *
 * The output is built from the values the scan already read. Spreading the live
 * objects instead would enumerate and read them a second time, which doubles
 * the invocations of an enumerable accessor and lets a non-idempotent getter
 * put a value into the output that the flatness check never saw. Assignment
 * from the scanned values measured within noise of the spread (2026-07-27), so
 * the second read bought nothing.
 */
function mergeDisjointFlatPlainObjects(
	prototype: object | null,
	leftProperties: FlatProperties,
	rightProperties: FlatProperties,
): MergeResult {
	const output = (prototype === Object.prototype
		? {}
		: Object.create(prototype)) as Record<PropertyKey, unknown>
	assignFlatProperties(output, leftProperties)
	assignFlatProperties(output, rightProperties)
	return { ok: true, value: output }
}

function hasDisjointKeys(left: object, rightKeys: readonly PropertyKey[]): boolean {
	for (let i = 0; i < rightKeys.length; i++) {
		if (Object.hasOwn(left, rightKeys[i]!))
			return false
	}
	return true
}

function hasPair(
	pairs: WeakMap<object, WeakSet<object>>,
	left: object,
	right: object,
): boolean {
	return pairs.get(left)
		?.has(right) === true
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

function registerPartners(
	left: object,
	right: object,
	context: PairingContext,
	path: PropertyKey[],
): CompatibilityResult {
	const mappedRight = context.leftPartners.get(left)
	if (mappedRight !== undefined && mappedRight !== right) {
		return createConflict(
			path,
			left,
			right,
			context.activeLeft.has(left) ? 'incompatible_cycle' : 'incompatible_alias',
		)
	}

	const mappedLeft = context.rightPartners.get(right)
	if (mappedLeft !== undefined && mappedLeft !== left) {
		return createConflict(
			path,
			left,
			right,
			context.activeRight.has(right) ? 'incompatible_cycle' : 'incompatible_alias',
		)
	}

	context.leftPartners.set(left, right)
	context.rightPartners.set(right, left)
	return { ok: true }
}

function discoverCompatibility(
	left: unknown,
	right: unknown,
	context: PairingContext,
	path: PropertyKey[],
): CompatibilityResult {
	if (Object.is(left, right))
		return { ok: true }

	const leftPlain = isPlainObject(left)
	const rightPlain = isPlainObject(right)
	if (!leftPlain || !rightPlain) {
		if (leftPlain !== rightPlain && (isObject(left) || isObject(right)))
			return createConflict(path, left, right, 'incompatible_prototype')
		if (isObject(left) && isObject(right)) {
			return createConflict(
				path,
				left,
				right,
				Object.getPrototypeOf(left) === Object.getPrototypeOf(right)
					? 'different_references'
					: 'incompatible_prototype',
			)
		}
		return createConflict(path, left, right, 'different_values')
	}

	if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right))
		return createConflict(path, left, right, 'incompatible_prototype')

	const registered = registerPartners(left, right, context, path)
	if (!registered.ok)
		return registered
	if (hasPair(context.visitedPairs, left, right))
		return { ok: true }
	markPair(context.visitedPairs, left, right)

	context.activeLeft.add(left)
	context.activeRight.add(right)
	const leftProperties = enumerableOwnProperties(left, context)
	const rightProperties = enumerableOwnProperties(right, context)
	for (const [key, leftValue] of leftProperties) {
		if (!rightProperties.has(key))
			continue
		const compatible = discoverCompatibility(
			leftValue,
			rightProperties.get(key),
			context,
			[...path, key],
		)
		if (!compatible.ok) {
			context.activeLeft.delete(left)
			context.activeRight.delete(right)
			return compatible
		}
	}
	context.activeLeft.delete(left)
	context.activeRight.delete(right)
	return { ok: true }
}

function cloneValue(
	value: unknown,
	side: MergeSide,
	context: MergeContext,
	path: PropertyKey[],
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
			? mergePlainObjects(value, partner as Record<PropertyKey, unknown>, context, path)
			: mergePlainObjects(partner as Record<PropertyKey, unknown>, value, context, path)
	}

	const output = Object.create(Object.getPrototypeOf(value)) as Record<PropertyKey, unknown>
	context.outputs.set(value, output)
	for (const [key, propertyValue] of enumerableOwnProperties(value, context)) {
		const cloned = cloneValue(propertyValue, side, context, [...path, key])
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
	path: PropertyKey[],
): MergeResult {
	if (left === right) {
		const existing = context.outputs.get(left)
		if (existing != null && existing !== left)
			return createConflict(path, left, right, 'incompatible_alias')
		context.outputs.set(left, left)
		markPair(context.mergedPairs, left, right)
		return { ok: true, value: left }
	}

	const leftOutput = context.outputs.get(left)
	const rightOutput = context.outputs.get(right)
	if (leftOutput != null && rightOutput != null && leftOutput !== rightOutput)
		return createConflict(path, left, right, 'incompatible_alias')

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
		const merged = mergeValues(leftValue, rightProperties.get(key), context, [...path, key])
		if (!merged.ok)
			return merged
		defineEnumerableValue(output, key, merged.value)
	}

	for (const [key, leftValue] of leftProperties) {
		if (rightProperties.has(key))
			continue
		const cloned = cloneValue(leftValue, 'left', context, [...path, key])
		if (!cloned.ok)
			return cloned
		defineEnumerableValue(output, key, cloned.value)
	}

	for (const [key, rightValue] of rightProperties) {
		if (leftProperties.has(key))
			continue
		const cloned = cloneValue(rightValue, 'right', context, [...path, key])
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
	path: PropertyKey[],
): MergeResult {
	if (isPlainObject(left) && isPlainObject(right))
		return mergePlainObjects(left, right, context, path)
	if (Object.is(left, right))
		return { ok: true, value: left }
	if (isObject(left) && isObject(right)) {
		return createConflict(
			path,
			left,
			right,
			Object.getPrototypeOf(left) === Object.getPrototypeOf(right)
				? 'different_references'
				: 'incompatible_prototype',
		)
	}
	return createConflict(path, left, right, 'different_values')
}

function hasEnumerableOwnPath(
	value: unknown,
	path: readonly PropertyKey[],
): boolean {
	if (path.length === 0)
		return true

	let current = value
	for (let i = 0; i < path.length; i++) {
		if (!isObject(current))
			return false
		const descriptor = Object.getOwnPropertyDescriptor(current, path[i]!)
		if (descriptor == null || !descriptor.enumerable)
			return false
		if (i === path.length - 1)
			return true
		if (!('value' in descriptor))
			return false
		current = descriptor.value
	}
	return false
}

function findConflictingLeftBranch(
	outputs: readonly unknown[],
	rightBranch: number,
	path: readonly PropertyKey[],
): number {
	for (let leftBranch = rightBranch - 1; leftBranch >= 0; leftBranch--) {
		if (hasEnumerableOwnPath(outputs[leftBranch], path))
			return leftBranch
	}
	return rightBranch - 1
}

function createPairingContext(
	left: unknown,
	right: unknown,
	leftProperties: FlatProperties | undefined,
	rightProperties: FlatProperties | undefined,
): PairingContext {
	const context: PairingContext = {
		leftPartners: new WeakMap(),
		rightPartners: new WeakMap(),
		visitedPairs: new WeakMap(),
		properties: new WeakMap(),
		activeLeft: new WeakSet(),
		activeRight: new WeakSet(),
	}
	// Hand over the values the fast path already read, so every property is read
	// exactly once even when the fast path declines after reading it.
	if (leftProperties != null)
		context.properties.set(left as object, toPropertyMap(leftProperties))
	if (rightProperties != null)
		context.properties.set(right as object, toPropertyMap(rightProperties))
	return context
}

function mergeOutputGraphs(left: unknown, right: unknown): MergeResult {
	let leftProperties: FlatProperties | undefined
	let rightProperties: FlatProperties | undefined

	if (isPlainObject(left) && isPlainObject(right) && left !== right) {
		const prototype = Object.getPrototypeOf(left)
		if (prototype === Object.getPrototypeOf(right)) {
			leftProperties = readFlatProperties(left)
			rightProperties = readFlatProperties(right)
			if (
				!leftProperties.hasNestedPlainObject
				&& !rightProperties.hasNestedPlainObject
				&& hasDisjointKeys(left, rightProperties.keys)
			) {
				return mergeDisjointFlatPlainObjects(prototype, leftProperties, rightProperties)
			}
		}
	}

	const pairingContext = createPairingContext(left, right, leftProperties, rightProperties)
	const compatibility = discoverCompatibility(left, right, pairingContext, [])
	if (!compatibility.ok)
		return compatibility

	return mergeValues(left, right, {
		...pairingContext,
		outputs: new WeakMap(),
		mergedPairs: new WeakMap(),
	}, [])
}

/* @__NO_SIDE_EFFECTS__ */
export const intersection = implStepPlugin<PluginDef>({
	intersection: ({
		utils: { addSuccessStep, success, failure, isFailure, createIssue, prependIssuePath },
		params: [branches, options],
	}) => {
		const message = snapshotMessage(options?.message)
		const branchExecutors = branches.map(branch => branch['~execute'])
		const operationMode: OperationMode = branches.every(branch => branch['~core']?.operationMode === 'sync')
			? 'sync'
			: 'maybe-async'
		const len = branchExecutors.length
		const branchesAreSynchronous = operationMode === 'sync'
		const collectAllIssues = options?.collectAllIssues === true

		const scopeIssues = (result: ExecutionResult): AnyExecutionIssue[] => {
			const issues: AnyExecutionIssue[] = []
			if (isFailure(result)) {
				for (const issue of result.issues)
					issues.push(prependIssuePath(issue, [], message))
			}
			return issues
		}

		const mergeOutputs = (outputs: unknown[]) => {
			if (outputs.length === 0)
				return success(undefined)

			let output = outputs[0]
			for (let i = 1; i < outputs.length; i++) {
				const rightOutput = outputs[i]
				const merged = mergeOutputGraphs(output, rightOutput)
				if (!merged.ok) {
					const { path, leftValue, rightValue, reason } = merged.conflict
					return failure(createIssue({
						code: 'intersection:conflicting_outputs',
						payload: markIssueSnapshotPayload({
							path,
							leftBranch: findConflictingLeftBranch(outputs, i, path),
							rightBranch: i,
							leftValue,
							rightValue,
							reason,
						}, { path: 'container' }),
						customMessage: message,
						defaultMessage: 'Intersection branch outputs conflict.',
					}))
				}
				output = merged.value
			}
			return success(output)
		}

		const executeFirstIssue = (value: unknown) => {
			const outputs: unknown[] = []

			const continueAsync = async (
				startIndex: number,
				firstResult: PromiseLike<ExecutionResult>,
			): Promise<ExecutionResult> => {
				for (let index = startIndex; index < len; index++) {
					const result = index === startIndex
						? await firstResult
						: await branchExecutors[index]!(value)
					if (isFailure(result))
						return failure(scopeIssues(result))
					outputs.push(result.value)
				}
				return mergeOutputs(outputs)
			}

			for (let index = 0; index < len; index++) {
				const result = branchExecutors[index]!(value)
				if (!branchesAreSynchronous && isPromiseLike(result))
					return continueAsync(index, result)
				const syncResult = result as ExecutionResult
				if (isFailure(syncResult))
					return failure(scopeIssues(syncResult))
				outputs.push(syncResult.value)
			}
			return mergeOutputs(outputs)
		}

		const executeCollectAll = (value: unknown) => {
			const outputs: unknown[] = []
			let issues: AnyExecutionIssue[] | undefined

			// Deliberately duplicated per-file: V8 inlines this local closure but not a shared cross-module helper. See architecture.md (extraction measured -12%/-13% on the failure hot path, 2026-07-22).
			const appendIssues = (result: ExecutionResult): boolean => {
				if (!isFailure(result)) {
					outputs.push(result.value)
					return false
				}
				let hasInternal = false
				const target = issues ??= []
				for (const issue of result.issues) {
					if (issue.category === 'internal')
						hasInternal = true
					target.push(prependIssuePath(issue, [], message))
				}
				return hasInternal
			}

			const processPending = async (
				pending: Promise<ExecutionResult>[],
			): Promise<ExecutionResult> => {
				const results = await Promise.all(pending)
				for (const result of results) {
					if (appendIssues(result))
						return failure(issues!)
				}
				return issues == null ? mergeOutputs(outputs) : failure(issues)
			}

			for (let index = 0; index < len; index++) {
				const result = branchExecutors[index]!(value)
				if (!branchesAreSynchronous && isPromiseLike(result)) {
					const pending: Promise<ExecutionResult>[] = [Promise.resolve(result)]
					for (let later = index + 1; later < len; later++)
						pending.push(Promise.resolve(branchExecutors[later]!(value)))
					return processPending(pending)
				}
				if (appendIssues(result as ExecutionResult))
					return failure(issues!)
			}
			return issues == null ? mergeOutputs(outputs) : failure(issues)
		}

		addSuccessStep(collectAllIssues ? executeCollectAll : executeFirstIssue, operationMode)
	},
})
