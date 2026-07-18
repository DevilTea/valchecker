import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import type { IsEqual, IsPromise, MaybePromiseLike } from '../../shared'
import { implStepPlugin } from '../../core'
import { hasInternalIssue } from '../../core/core'
import { isPromiseLike } from '../../shared'

declare namespace Internal {
	export type Issue<I extends AnyExecutionIssue = AnyExecutionIssue> = ExecutionIssue<
		'fallback:failed',
		{ receivedIssues: [I, ...I[]], error: unknown },
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
						run: (issues: [InferIssue<This>, ...InferIssue<This>[]]) => Result,
						options?: StepOptions<Internal.Issue<InferIssue<This>>>,
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

function snapshotReceivedIssues<Issue extends AnyExecutionIssue>(
	issues: [Issue, ...Issue[]],
): [Issue, ...Issue[]] {
	return issues.map((issue) => {
		const snapshot = {
			...issue,
			path: [...issue.path],
		}
		if (issue.context != null)
			snapshot.context = [...issue.context]
		return snapshot
	}) as [Issue, ...Issue[]]
}

/* @__NO_SIDE_EFFECTS__ */
export const fallback = implStepPlugin<PluginDef>({
	fallback: ({
		utils: { addFailureStep, success, createIssue, failure },
		params: [run, options],
	}) => {
		addFailureStep((issues) => {
			if (hasInternalIssue(issues))
				return failure(issues)

			const callbackIssues = snapshotReceivedIssues(issues)

			const handleError = (error: unknown) => {
				const fallbackIssue = createIssue({
					code: 'fallback:failed',
					category: 'operation',
					payload: { receivedIssues: snapshotReceivedIssues(issues), error },
					customMessage: options?.message,
					defaultMessage: 'Fallback failed.',
				})
				return failure([...issues, fallbackIssue])
			}

			try {
				const result = run(callbackIssues)
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
