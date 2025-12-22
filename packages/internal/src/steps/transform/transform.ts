import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import type { IsEqual, IsPromise } from '../../shared'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type RunTransform<Input = any, Result = any> = (value: Input) => Result

	export type Issue<Input = unknown> = ExecutionIssue<'transform:failed', { value: Input, error: unknown }>
}

type Meta = DefineStepMethodMeta<{
	Name: 'transform'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Transforms the value using a provided function.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, transform, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [transform, string] })
	 * const schema = v.string().transform((value) => value.toUpperCase())
	 * const result = schema.execute('hello')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'transform:failed'`: Transform failed.
	 */
	transform: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			?	InferOutput<this['CurrentValchecker']> extends infer CurrentOutput
				?	<Result>(
						run: Internal.RunTransform<CurrentOutput, Result>,
						message?: MessageHandler<Internal.Issue<CurrentOutput>>,
					) => Next<
						{
							async: IsEqual<IsPromise<Result>, true> extends true
								? 'async'
								: IsEqual<IsPromise<Result>, false> extends true
									? 'sync'
									: 'maybe-async'
							output: Awaited<NoInfer<Result>>
							issue: Internal.Issue<CurrentOutput>
						},
						this['CurrentValchecker']
					>
				:	never
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const transform = implStepPlugin<PluginDef>({
	transform: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [run, message],
	}) => {
		addSuccessStep((value) => {
			const handleError = (err: unknown) => {
				return failure(
					createIssue({
						code: 'transform:failed',
						payload: { value, error: err },
						customMessage: message,
						defaultMessage: 'Transform failed',
					}),
				)
			}
			try {
				const result = run(value)
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
