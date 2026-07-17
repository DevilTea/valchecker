import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import type { IsEqual, IsPromise } from '../../shared'
import { implStepPlugin } from '../../core'
import { isPromiseLike } from '../../shared'

declare namespace Internal {
	export type RunTransform<Input = any, Result = any> = (value: Input) => Result
	export type Issue<Input = unknown> = ExecutionIssue<
		'transform:callback_failed',
		{ phase: 'throw' | 'reject', value: Input, error: unknown },
		'operation'
	>
}

type Meta = DefineStepMethodMeta<{
	Name: 'transform'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * Applies an arbitrary synchronous or asynchronous transformation.
	 * Throwing and rejected callbacks emit the operation issue
	 * `transform:callback_failed` with the callback phase and original error.
	 */
	transform: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? InferOutput<this['CurrentValchecker']> extends infer CurrentOutput
				? <Result>(
					run: Internal.RunTransform<CurrentOutput, Result>,
					message?: MessageHandler<Internal.Issue<CurrentOutput>>,
				) => Next<{
					operationMode: IsEqual<IsPromise<Result>, true> extends true
						? 'maybe-async'
						: IsEqual<IsPromise<Result>, false> extends true
							? 'sync'
							: 'maybe-async'
					output: Awaited<NoInfer<Result>>
					issue: Internal.Issue<CurrentOutput>
				}, this['CurrentValchecker']>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const transform = implStepPlugin<PluginDef>({
	transform: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [run, message],
	}) => {
		addSuccessStep((value) => {
			const callbackFailure = (phase: 'throw' | 'reject', error: unknown) => failure(
				createIssue({
					code: 'transform:callback_failed',
					category: 'operation',
					payload: { phase, value, error },
					customMessage: message,
					defaultMessage: 'Transform callback failed.',
				}),
			)
			try {
				const result = run(value)
				return isPromiseLike(result)
					? Promise.resolve(result).then(success, error => callbackFailure('reject', error))
					: success(result)
			}
			catch (error) {
				return callbackFailure('throw', error)
			}
		})
	},
})
