import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import type { IsEqual, IsPromise, MaybePromiseLike } from '../../shared'
import { hasInternalIssue, implStepPlugin } from '../../core'
import { isPromiseLike } from '../../shared'

declare namespace Internal {
	export type Issue<I extends AnyExecutionIssue = AnyExecutionIssue> = ExecutionIssue<
		'fallback:failed',
		{ receivedIssues: I[], error: unknown },
		'operation'
	>
}

type Meta = DefineStepMethodMeta<{
	Name: 'fallback'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * Recovers validation and operation failures with a fallback value.
	 * Internal issues are fatal and bypass the callback. If the callback throws
	 * or rejects, the original issues and an operation issue are both returned.
	 */
	fallback: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? InferOutput<This> extends infer CurrentOutput
				? <Result extends MaybePromiseLike<CurrentOutput>>(
					run: (issues: InferIssue<This>[]) => Result,
					message?: MessageHandler<Internal.Issue<InferIssue<This>>>,
				) => Next<{
					operationMode: IsEqual<IsPromise<Result>, true> extends true
						? 'maybe-async'
						: IsEqual<IsPromise<Result>, false> extends true
							? 'sync'
							: 'maybe-async'
					issue: Internal.Issue<InferIssue<This>>
				}, This>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const fallback = implStepPlugin<PluginDef>({
	fallback: ({
		utils: { addFailureStep, success, createIssue, failure },
		params: [run, message],
	}) => {
		addFailureStep((issues) => {
			if (hasInternalIssue(issues))
				return failure(issues)

			const handleError = (error: unknown) => {
				const fallbackIssue = createIssue({
					code: 'fallback:failed',
					category: 'operation',
					payload: { receivedIssues: issues, error },
					customMessage: message,
					defaultMessage: 'Fallback failed.',
				})
				return failure([...issues, fallbackIssue])
			}

			try {
				const result = run(issues)
				return isPromiseLike(result)
					? Promise.resolve(result)
						.then(value => success(value))
						.catch(handleError)
					: success(result)
			}
			catch (error) {
				return handleError(error)
			}
		})
	},
})
