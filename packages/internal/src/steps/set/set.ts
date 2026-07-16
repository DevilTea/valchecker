import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, MessageHandler, Next, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'
import { isPromiseLike } from '../../shared'

declare namespace Internal {
	export type OpMode<I extends Use<Valchecker>> = IsEqual<InferOperationMode<I>, 'sync'> extends true ? 'sync' : 'maybe-async'
	export type SelfIssue = ExecutionIssue<'set:expected_set', { value: unknown }>
	export type Issue<I extends Use<Valchecker> = Use<Valchecker>> = SelfIssue | InferIssue<I>
}

type Meta = DefineStepMethodMeta<{
	Name: 'set'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.SelfIssue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * Validates and transforms every item of a `Set` in insertion order.
	 *
	 * @example `v.set(v.string())`
	 * @issue `set:expected_set`
	 */
	set: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				? <I extends Use<Valchecker>>(item: I, message?: MessageHandler<Internal.Issue<I>>) => Next<{
					operationMode: Internal.OpMode<I>
					output: Set<InferOutput<I>>
					issue: Internal.Issue<I>
				}, this['CurrentValchecker']>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const set = implStepPlugin<PluginDef>({
	set: ({
		utils: { addSuccessStep, success, createIssue, failure, isFailure, prependIssuePath },
		params: [itemSchema, message],
	}) => {
		const execute = itemSchema['~execute']
		addSuccessStep((value) => {
			if (!(value instanceof Set)) {
				return failure(createIssue({
					code: 'set:expected_set',
					payload: { value },
					customMessage: message,
					defaultMessage: 'Expected a Set.',
				}))
			}

			const items = [...value.values()]
			const output = new Set<unknown>()
			const issues: ExecutionIssue[] = []
			const processResult = (result: ExecutionResult, index: number) => {
				if (isFailure(result)) {
					for (const issue of result.issues)
						issues.push(prependIssuePath(issue, [index]))
				}
				else {
					output.add(result.value)
				}
			}
			for (let i = 0; i < items.length; i++) {
				const result = execute(items[i])
				if (isPromiseLike(result)) {
					let chain = Promise.resolve(result).then(r => processResult(r, i))
					for (let j = i + 1; j < items.length; j++) {
						const index = j
						chain = chain.then(() => Promise.resolve(execute(items[index])).then(r => processResult(r, index)))
					}
					return chain.then(() => issues.length > 0 ? failure(issues) : success(output as any))
				}
				processResult(result, i)
			}
			return issues.length > 0 ? failure(issues) : success(output as any)
		})
	},
})
