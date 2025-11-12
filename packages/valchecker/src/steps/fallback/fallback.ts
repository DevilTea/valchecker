import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import type { IsPromise, MaybePromise } from '../../shared'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue<I extends ExecutionIssue = ExecutionIssue> = ExecutionIssue<'fallback:failed', { receivedIssues: I[], error?: unknown }>
}

type Meta = DefineStepMethodMeta<{
	Name: 'fallback'
	ExpectedThis: DefineExpectedValchecker
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Provides a fallback value when the previous steps fail.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, fallback, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [fallback, string] })
	 * const schema = v.string().fallback(() => 'default')
	 * const result = schema.execute(123)
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'fallback:failed'`: The fallback function threw an error.
	 */
	fallback: DefineStepMethod<
		Meta,
		this['This'] extends infer This extends Meta['ExpectedThis']
			?	InferOutput<This> extends infer CurrentOutput
				?	<Result extends MaybePromise<CurrentOutput>>(
						run: (issues: InferIssue<This>[]) => Result,
						message?: MessageHandler<Internal.Issue<InferIssue<This>>>
					) => Next<
						{
							async: IsPromise<Result> extends false ? false : true
							issue: Internal.Issue<InferIssue<This>>
						},
						This
					>
				:	never
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const fallback = implStepPlugin<PluginDef>({
	fallback: ({
		utils: { addFailureStep, success, resolveMessage, failure },
		params: [run, message],
	}) => {
		addFailureStep((issues) => {
			const handleError = (err: unknown) => {
				return failure({
					code: 'fallback:failed',
					payload: { receivedIssues: issues, error: err },
					message: resolveMessage(
						{
							code: 'fallback:failed',
							payload: { receivedIssues: issues, error: err },
						},
						message,
						'Fallback failed',
					),
				})
			}
			try {
				const result = run(issues)
				return result instanceof Promise
					?	result
							.then(res => success(res))
							.catch(err => handleError(err))
					:	success(result)
			}
			catch (error) {
				return handleError(error)
			}
		})
	},
})
