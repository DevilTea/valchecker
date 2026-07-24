import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, Next, OperationMode, StructuralStepOptions, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'
import { isPromiseLike } from '../../shared'

const REST_MARKER = '...'

declare namespace Internal {
	export type RestMarker = '...'
	export type Element = Use<Valchecker> | RestMarker
	export type Elements = readonly Element[]

	// Splits the element list into a fixed prefix, an optional single rest
	// schema, and a fixed suffix. Resolves to `never` for every malformed
	// arrangement (two markers, trailing marker, adjacent markers, or a rest
	// entry whose output is not an array).
	export type Parse<E extends readonly unknown[], Prefix extends readonly unknown[] = readonly []>
		= E extends readonly []
			? { prefix: Prefix, rest: undefined, suffix: readonly [] }
			: E extends readonly [infer Head, ...infer Tail]
				? Head extends RestMarker
					? Tail extends readonly [infer R, ...infer Suffix]
						? RestMarker extends Suffix[number]
							? never
							: R extends RestMarker
								? never
								: R extends Use<Valchecker>
									? InferOutput<R> extends readonly unknown[]
										? { prefix: Prefix, rest: R, suffix: Suffix }
										: never
									: never
						: never
					: Parse<Tail, readonly [...Prefix, Head]>
				: never

	type OutputsOf<T extends readonly unknown[]> = { -readonly [K in keyof T]: T[K] extends Use<Valchecker> ? InferOutput<T[K]> : never }

	// Compile-time validity gate applied to the `elements` argument. A general
	// `Element[]` (the constraint instantiation seen by the step impl) has a
	// `number` length and is intentionally NOT gated; a concrete tuple whose
	// arrangement is malformed resolves `Parse` to `never` and rejects.
	export type ElementsGate<E extends Elements> = number extends E['length']
		? unknown
		: [Parse<E>] extends [never] ? never : unknown

	export type Output<E extends Elements>
		= [Parse<E>] extends [never]
			? unknown[]
			: Parse<E> extends infer P
				? P extends { prefix: infer Pre extends readonly unknown[], rest: infer R, suffix: infer Suf extends readonly unknown[] }
					? [R] extends [undefined]
							? OutputsOf<Pre>
							: InferOutput<R & Use<Valchecker>> extends infer RO extends readonly unknown[]
								? [...OutputsOf<Pre>, ...RO, ...OutputsOf<Suf>]
								: never
					: never
				: never

	type Schemas<E extends Elements> = Extract<E[number], Use<Valchecker>>
	type ResolveMode<M extends OperationMode> = IsEqual<M, 'sync'> extends true ? 'sync' : 'maybe-async'
	export type OpMode<E extends Elements> = [Schemas<E>] extends [never]
		? 'sync'
		: ResolveMode<InferOperationMode<Schemas<E>>>

	export type SelfIssue
		= | ExecutionIssue<'tuple:expected_array', { value: unknown }>
			| ExecutionIssue<'tuple:unexpected_length', { value: unknown, expectedLength: number, length: number }>
			| ExecutionIssue<'tuple:expected_length_at_least', { value: unknown, minimumLength: number, length: number }>

	export type Issue<E extends Elements> = SelfIssue | InferIssue<Schemas<E>>
}

type Meta = DefineStepMethodMeta<{
	Name: 'tuple'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.SelfIssue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is a fixed-shape array with per-position schemas,
	 * aligning with a TypeScript tuple. A single `'...'` marker declares the NEXT
	 * entry as a rest region: its output must be an array and is spread into the
	 * result, so `v.array(X)` yields a variadic `...X[]` and `v.tuple([A, B])`
	 * yields a fixed spread. One rest region is allowed in leading, middle, or
	 * trailing position.
	 *
	 * ```ts
	 * v.tuple([v.string(), v.number()])                          // [string, number]
	 * v.tuple([v.string(), '...', v.array(v.number())])          // [string, ...number[]]
	 * v.tuple([v.string(), '...', v.array(v.boolean()), v.number()]) // [string, ...boolean[], number]
	 * ```
	 *
	 * limit: optional tuple elements (`[A, B?]`) are not expressible; the ceiling
	 * is TS mapped tuples (no conditional `?` slots). Upgrade path: a dedicated
	 * per-entry optional marker once TS can express it, or the documented
	 * workaround `[A, '...', v.union([v.tuple([]), v.tuple([B])])]`, which yields
	 * the exact `[A] | [A, B]` output today (differs from TS `[A, B?]` only in
	 * that TS also admits `[A, undefined]`).
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, number, string, tuple } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [tuple, string, number] })
	 * const schema = v.tuple([v.string(), v.number()])
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'tuple:expected_array'`: The value is not an array.
	 * - `'tuple:unexpected_length'`: A rest-less tuple received the wrong length.
	 * - `'tuple:expected_length_at_least'`: A tuple with a rest region received too few elements.
	 */
	tuple: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? IsExactlyAnyOrUnknown<InferOutput<This>> extends true
				? <const E extends Internal.Elements>(
						elements: E & Internal.ElementsGate<E>,
						options?: StructuralStepOptions<Internal.Issue<NoInfer<E>>>,
					) => Next<{
						operationMode: Internal.OpMode<E>
						output: Internal.Output<E>
						issue: Internal.Issue<E>
					}, This>
				: never
			: never
	>
}

function isValcheckerSchema(value: unknown): value is Use<Valchecker> {
	return (
		typeof value === 'function'
		|| (typeof value === 'object' && value !== null)
	) && typeof Reflect.get(value as object, '~execute') === 'function'
}

/* @__NO_SIDE_EFFECTS__ */
export const tuple = implStepPlugin<PluginDef>({
	tuple: ({
		utils: { addSuccessStep, success, createIssue, failure, isFailure, prependIssuePath, replaceIssuePath, appendIssueContext },
		params: [elements, options],
	}) => {
		if (!Array.isArray(elements))
			throw new TypeError('tuple() requires an element array.')

		const prefixExecutes: Use<Valchecker>['~execute'][] = []
		const suffixExecutes: Use<Valchecker>['~execute'][] = []
		let restExecute: Use<Valchecker>['~execute'] | undefined
		let seenRest = false
		let operationMode: OperationMode = 'sync'

		for (let i = 0; i < elements.length; i++) {
			const element = elements[i]
			if (element === REST_MARKER) {
				if (seenRest)
					throw new TypeError('tuple() allows at most one "..." rest marker.')
				const next = elements[i + 1]
				if (i + 1 >= elements.length || next === REST_MARKER || !isValcheckerSchema(next))
					throw new TypeError('tuple() "..." must be followed by a rest schema.')
				restExecute = next['~execute']
				if (next['~core']?.operationMode !== 'sync')
					operationMode = 'maybe-async'
				seenRest = true
				i++
				continue
			}
			if (!isValcheckerSchema(element))
				throw new TypeError(`tuple() element at index ${i} must be a Valchecker schema.`)
			if (seenRest)
				suffixExecutes.push(element['~execute'])
			else
				prefixExecutes.push(element['~execute'])
			if (element['~core']?.operationMode !== 'sync')
				operationMode = 'maybe-async'
		}

		const p = prefixExecutes.length
		const s = suffixExecutes.length
		const hasRest = restExecute != null
		const childrenAreSynchronous = operationMode === 'sync'
		const collectAllIssues = options?.collectAllIssues === true
		const unexpectedLengthMessage = `Expected a tuple of length ${p}.`
		const atLeastMessage = `Expected a tuple of length at least ${p + s}.`

		// Deliberately duplicated per-file: V8 inlines this local closure but not a shared cross-module helper. See architecture.md.
		const appendChildIssues = (
			result: ExecutionResult,
			index: number,
			issues: AnyExecutionIssue[] | undefined,
		): { issues: AnyExecutionIssue[], hasInternal: boolean } => {
			let hasInternal = false
			const target = issues ?? []
			if (isFailure(result)) {
				for (const issue of result.issues) {
					if (issue.category === 'internal')
						hasInternal = true
					target.push(prependIssuePath(issue, [index], options?.message))
				}
			}
			return { issues: target, hasInternal }
		}

		const appendRestIssues = (
			result: ExecutionResult,
			issues: AnyExecutionIssue[] | undefined,
		): { issues: AnyExecutionIssue[], hasInternal: boolean } => {
			let hasInternal = false
			const target = issues ?? []
			if (isFailure(result)) {
				for (const issue of result.issues) {
					if (issue.category === 'internal')
						hasInternal = true
					const head = issue.path[0]
					const newPath = typeof head === 'number'
						? [p + head, ...issue.path.slice(1)]
						: issue.path
					target.push(appendIssueContext(
						replaceIssuePath(issue, newPath, options?.message),
						{ type: 'tuple', part: 'rest' },
					))
				}
			}
			return { issues: target, hasInternal }
		}

		const sliceRest = (value: unknown[], length: number): unknown[] => {
			const restLen = length - s - p
			const slice: unknown[] = []
			for (let i = 0; i < restLen; i++)
				slice.push(value[p + i])
			return slice
		}

		const handleChildResult = (
			result: ExecutionResult,
			index: number,
			output: unknown[],
			issues: AnyExecutionIssue[] | undefined,
		): { issues: AnyExecutionIssue[] | undefined, stop: boolean } => {
			if (isFailure(result)) {
				const appended = appendChildIssues(result, index, issues)
				return { issues: appended.issues, stop: appended.hasInternal || !collectAllIssues }
			}
			output.push(result.value)
			return { issues, stop: false }
		}

		const handleRestResult = (
			result: ExecutionResult,
			output: unknown[],
			issues: AnyExecutionIssue[] | undefined,
		): { issues: AnyExecutionIssue[] | undefined, stop: boolean } => {
			if (isFailure(result)) {
				const appended = appendRestIssues(result, issues)
				return { issues: appended.issues, stop: appended.hasInternal || !collectAllIssues }
			}
			const restValue = result.value
			if (!Array.isArray(restValue))
				throw new TypeError('tuple() rest schema must output an array.')
			for (let i = 0; i < restValue.length; i++)
				output.push(restValue[i])
			return { issues, stop: false }
		}

		const runAsync = async (
			phase: 'prefix' | 'rest' | 'suffix',
			startIndex: number,
			firstResult: PromiseLike<ExecutionResult>,
			value: unknown[],
			output: unknown[],
			issues: AnyExecutionIssue[] | undefined,
		) => {
			const length = value.length

			if (phase === 'prefix') {
				for (let i = startIndex; i < p; i++) {
					const result = i === startIndex ? await firstResult : await prefixExecutes[i]!(value[i])
					const handled = handleChildResult(result, i, output, issues)
					issues = handled.issues
					if (handled.stop)
						return failure(issues!)
				}
			}

			if (hasRest && phase !== 'suffix') {
				const result = phase === 'rest'
					? await firstResult
					: await restExecute!(sliceRest(value, length))
				const handled = handleRestResult(result, output, issues)
				issues = handled.issues
				if (handled.stop)
					return failure(issues!)
			}

			for (let j = phase === 'suffix' ? startIndex : 0; j < s; j++) {
				const idx = length - s + j
				const result = phase === 'suffix' && j === startIndex
					? await firstResult
					: await suffixExecutes[j]!(value[idx])
				const handled = handleChildResult(result, idx, output, issues)
				issues = handled.issues
				if (handled.stop)
					return failure(issues!)
			}

			return issues == null ? success(output) : failure(issues)
		}

		addSuccessStep((value) => {
			if (!Array.isArray(value)) {
				return failure(createIssue({
					code: 'tuple:expected_array',
					payload: { value },
					customMessage: options?.message,
					defaultMessage: 'Expected an array.',
				}))
			}

			const length = value.length
			if (!hasRest) {
				if (length !== p) {
					return failure(createIssue({
						code: 'tuple:unexpected_length',
						payload: { value, expectedLength: p, length },
						customMessage: options?.message,
						defaultMessage: unexpectedLengthMessage,
					}))
				}
			}
			else if (length < p + s) {
				return failure(createIssue({
					code: 'tuple:expected_length_at_least',
					payload: { value, minimumLength: p + s, length },
					customMessage: options?.message,
					defaultMessage: atLeastMessage,
				}))
			}

			let issues: AnyExecutionIssue[] | undefined
			const output: unknown[] = []

			for (let i = 0; i < p; i++) {
				const result = prefixExecutes[i]!(value[i])
				if (!childrenAreSynchronous && isPromiseLike(result))
					return runAsync('prefix', i, result, value, output, issues)
				const handled = handleChildResult(result as ExecutionResult, i, output, issues)
				issues = handled.issues
				if (handled.stop)
					return failure(issues!)
			}

			if (hasRest) {
				const result = restExecute!(sliceRest(value, length))
				if (!childrenAreSynchronous && isPromiseLike(result))
					return runAsync('rest', 0, result, value, output, issues)
				const handled = handleRestResult(result as ExecutionResult, output, issues)
				issues = handled.issues
				if (handled.stop)
					return failure(issues!)
			}

			for (let j = 0; j < s; j++) {
				const idx = length - s + j
				const result = suffixExecutes[j]!(value[idx])
				if (!childrenAreSynchronous && isPromiseLike(result))
					return runAsync('suffix', j, result, value, output, issues)
				const handled = handleChildResult(result as ExecutionResult, idx, output, issues)
				issues = handled.issues
				if (handled.stop)
					return failure(issues!)
			}

			return issues == null ? success(output) : failure(issues)
		}, operationMode)
	},
})
