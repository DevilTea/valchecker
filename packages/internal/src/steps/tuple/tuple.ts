import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, MessageHandler, Next, OperationMode, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'
import { isPromiseLike } from '../../shared'

declare namespace Internal {
	export type Items = readonly Use<Valchecker>[]

	export type Output<I extends Items> = I extends readonly [infer H extends Use<Valchecker>, ...infer T extends Items]
		? [InferOutput<H>, ...Output<T>]
		: []

	type Modes<I extends Items> = I[number] extends infer S
		? S extends Use<Valchecker> ? InferOperationMode<S> : never
		: never

	type ResolveMode<M> = [M] extends [never]
		? 'sync'
		: M extends OperationMode
			? IsEqual<M, 'sync'> extends true ? 'sync' : 'maybe-async'
			: never

	export type OpMode<I extends Items, R extends Use<Valchecker> | undefined = undefined>
		= ResolveMode<Modes<I> | (R extends Use<Valchecker> ? InferOperationMode<R> : never)>

	export type ChildIssue<I extends Items, R extends Use<Valchecker> | undefined = undefined>
		= (I[number] extends infer S
			? S extends Use<Valchecker> ? InferIssue<S> : never
			: never)
		| (R extends Use<Valchecker> ? InferIssue<R> : never)

	export type SelfIssue
		= | ExecutionIssue<'tuple:expected_array', { value: unknown }>
			| ExecutionIssue<'tuple:expected_length', { value: unknown[], expected: number, received: number, rest: boolean }>

	export type Issue<I extends Items = Items, R extends Use<Valchecker> | undefined = undefined>
		= SelfIssue | ChildIssue<I, R>
}

type Meta = DefineStepMethodMeta<{
	Name: 'tuple'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.SelfIssue
}>

type TupleMethod<Current extends Use<Valchecker>> = {
	<const I extends Internal.Items>(items: I, message?: MessageHandler<Internal.Issue<I>>): Next<{
		operationMode: Internal.OpMode<I>
		output: Internal.Output<I>
		issue: Internal.Issue<I>
	}, Current>
	<const I extends Internal.Items, R extends Use<Valchecker>>(items: I, rest: R, message?: MessageHandler<Internal.Issue<I, R>>): Next<{
		operationMode: Internal.OpMode<I, R>
		output: [...Internal.Output<I>, ...InferOutput<R>[]]
		issue: Internal.Issue<I, R>
	}, Current>
}

interface PluginDef extends TStepPluginDef {
	/**
	 * Validates a fixed TypeScript tuple. Passing a rest schema creates a variadic tuple.
	 * Fixed tuples reject both missing and extra items instead of stripping them.
	 *
	 * @example `v.tuple([v.string(), v.number()])`
	 * @example `v.tuple([v.string()], v.number())`
	 * @issue `tuple:expected_array`
	 * @issue `tuple:expected_length`
	 */
	tuple: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				? TupleMethod<this['CurrentValchecker']>
				: never
			: never
	>
}

function isSchema(value: unknown): value is Use<Valchecker> {
	return typeof value === 'object' && value !== null && typeof (value as Use<Valchecker>)['~execute'] === 'function'
}

/* @__NO_SIDE_EFFECTS__ */
export const tuple = implStepPlugin<PluginDef>({
	tuple: ({
		utils: { addSuccessStep, success, createIssue, failure, isFailure, prependIssuePath },
		params,
	}) => {
		const [items, restOrMessage, restMessage] = params
		const rest = isSchema(restOrMessage) ? restOrMessage : undefined
		const message = rest === undefined ? restOrMessage : restMessage
		const itemExecutors = items.map(item => item['~execute'])
		const restExecutor = rest?.['~execute']
		const fixedLength = itemExecutors.length

		addSuccessStep((value) => {
			if (!Array.isArray(value)) {
				return failure(createIssue({
					code: 'tuple:expected_array',
					payload: { value },
					customMessage: message,
					defaultMessage: 'Expected a tuple.',
				}))
			}
			if ((restExecutor === undefined && value.length !== fixedLength) || (restExecutor !== undefined && value.length < fixedLength)) {
				return failure(createIssue({
					code: 'tuple:expected_length',
					payload: { value, expected: fixedLength, received: value.length, rest: restExecutor !== undefined },
					customMessage: message,
					defaultMessage: restExecutor === undefined
						? `Expected a tuple with exactly ${fixedLength} items.`
						: `Expected a tuple with at least ${fixedLength} items.`,
				}))
			}

			const issues: ExecutionIssue[] = []
			const output: unknown[] = new Array(value.length)
			const processResult = (result: ExecutionResult, index: number) => {
				if (isFailure(result)) {
					for (const issue of result.issues)
						issues.push(prependIssuePath(issue, [index]))
				}
				else {
					output[index] = result.value
				}
			}
			const executeAt = (index: number) => (index < fixedLength ? itemExecutors[index]! : restExecutor!)(value[index])

			for (let i = 0; i < value.length; i++) {
				const result = executeAt(i)
				if (isPromiseLike(result)) {
					let chain = Promise.resolve(result).then(r => processResult(r, i))
					for (let j = i + 1; j < value.length; j++) {
						const index = j
						chain = chain.then(() => Promise.resolve(executeAt(index)).then(r => processResult(r, index)))
					}
					return chain.then(() => issues.length > 0 ? failure(issues) : success(output as any))
				}
				processResult(result, i)
			}
			return issues.length > 0 ? failure(issues) : success(output as any)
		})
	},
})
