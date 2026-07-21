import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import type { IsEqual, IsPromise, MaybePromiseLike } from '../../shared'
import { implStepPlugin } from '../../core'
import { preserveExecutionEffects } from '../../core/execution-effects'
import { isPromiseLike, returnTrue } from '../../shared'

declare namespace Internal {
	export type True<T> = true & { readonly '~output': T }
	export interface RunCheckUtils<Input, I extends AnyExecutionIssue> {
		readonly narrow: <T extends Input>() => True<T>
		readonly addIssue: (issue: I) => void
	}
	export type RunCheckResult = MaybePromiseLike<void | boolean | string | True<any>>
	export type RunCheck<Input = any, I extends AnyExecutionIssue = AnyExecutionIssue, Result extends RunCheckResult = RunCheckResult> = (value: Input, utils: RunCheckUtils<Input, I>) => Result

	export type FailedIssue<Input = unknown>
		= | ExecutionIssue<'check:failed', { reason: 'returned_false', value: Input }>
			| ExecutionIssue<'check:failed', { reason: 'returned_message', value: Input, returnedMessage: string }>
	export type CallbackFailedIssue<Input = unknown> = ExecutionIssue<
		'check:callback_failed',
		{ phase: 'throw' | 'reject', value: Input, error: unknown },
		'operation'
	>
	export type Issue<Input = unknown> = FailedIssue<Input> | CallbackFailedIssue<Input>
}

type Meta = DefineStepMethodMeta<{
	Name: 'check'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * Runs a custom predicate, type guard, or issue-producing callback.
	 *
	 * Returning `false` or a string emits `check:failed`. Throwing or rejecting
	 * emits the operation issue `check:callback_failed`. Use `check<AddedIssue>()`
	 * when `addIssue()` introduces domain-specific issue types.
	 */
	check:
		| DefineStepMethod<
			Meta,
			this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
				? [InferOutput<This>, InferIssue<This>] extends [infer CurrentOutput, infer CurrentIssue extends AnyExecutionIssue]
						? <AddedIssue extends AnyExecutionIssue = never, Output extends CurrentOutput = CurrentOutput>(
								run: (value: CurrentOutput, utils: Internal.RunCheckUtils<CurrentOutput, CurrentIssue | AddedIssue>) => value is Output,
								options?: StepOptions<Internal.Issue<CurrentOutput> | CurrentIssue | AddedIssue>,
							) => Next<{
								operationMode: 'sync'
								output: Output
								issue: Internal.Issue<CurrentOutput> | AddedIssue
							}, This>
						: never
				: never
		>
		| DefineStepMethod<
			Meta,
			this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
				? [InferOutput<This>, InferIssue<This>] extends [infer CurrentOutput, infer CurrentIssue extends AnyExecutionIssue]
						? <AddedIssue extends AnyExecutionIssue = never, Result extends Internal.RunCheckResult = Internal.RunCheckResult>(
								run: Internal.RunCheck<CurrentOutput, CurrentIssue | AddedIssue, Result>,
								options?: StepOptions<Internal.Issue<CurrentOutput> | CurrentIssue | AddedIssue>,
							) => Next<{
								operationMode: IsEqual<IsPromise<Result>, true> extends true
									? 'maybe-async'
									: IsEqual<IsPromise<Result>, false> extends true
										? 'sync'
										: 'maybe-async'
								output: Awaited<Result> extends (Internal.True<infer T> | false) ? T : CurrentOutput
								issue: Internal.Issue<CurrentOutput> | AddedIssue
							}, This>
						: never
				: never
		>
}

/* @__NO_SIDE_EFFECTS__ */
export const check = implStepPlugin<PluginDef>({
	check: ({
		utils,
		params: [run, options],
	}) => {
		const { addSuccessStep, success, createIssue, failure, prependIssuePath } = utils
		preserveExecutionEffects(utils, { parentTraversal: 'snapshot-required' })
		addSuccessStep((value) => {
			let issues: AnyExecutionIssue[] | undefined
			const addIssue = (issue: AnyExecutionIssue) => {
				(issues ??= []).push(prependIssuePath(issue, [], options?.message))
			}
			const callbackFailure = (phase: 'throw' | 'reject', error: unknown) => {
				const issue = createIssue({
					code: 'check:callback_failed',
					category: 'operation',
					payload: { phase, value, error },
					customMessage: options?.message,
					defaultMessage: 'Check callback failed.',
				})
				return failure(issues == null ? issue : [...issues, issue])
			}
			const process = (result: Awaited<Internal.RunCheckResult>) => {
				if (result === false) {
					const issue = createIssue({
						code: 'check:failed',
						payload: { reason: 'returned_false', value },
						customMessage: options?.message,
						defaultMessage: 'Check failed',
					})
					return failure(issues == null ? issue : [...issues, issue])
				}
				if (typeof result === 'string') {
					const issue = createIssue({
						code: 'check:failed',
						payload: { reason: 'returned_message', value, returnedMessage: result },
						customMessage: options?.message,
						defaultMessage: result,
					})
					return failure(issues == null ? issue : [...issues, issue])
				}
				return issues == null ? success(value) : failure(issues)
			}

			try {
				const result = run(value, {
					narrow: returnTrue as <T>() => Internal.True<T>,
					addIssue,
				})
				return isPromiseLike(result)
					? Promise.resolve(result)
							.then(process, error => callbackFailure('reject', error))
					: process(result)
			}
			catch (error) {
				return callbackFailure('throw', error)
			}
		}, 'maybe-async')
	},
})
