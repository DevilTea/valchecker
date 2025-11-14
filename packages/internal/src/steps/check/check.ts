import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import type { IsPromise, MaybePromise } from '../../shared'
import { implStepPlugin } from '../../core'
import { returnTrue } from '../../shared'

declare namespace Internal {
	export type True<T> = true & { readonly '~output': T }
	export interface RunCheckUtils<Input, I extends ExecutionIssue> {
		readonly narrow: <T extends Input>() => True<T>
		readonly addIssue: (issue: I) => void
	}
	export type RunCheckResult = MaybePromise<void | boolean | string | True<any>>
	export type RunCheck<Input = any, I extends ExecutionIssue = ExecutionIssue, Result extends RunCheckResult = RunCheckResult> = (value: Input, utils: RunCheckUtils<Input, I>) => Result

	export type Issue<Input = unknown> = ExecutionIssue<'check:failed', { value: Input, error?: unknown }>
}

type Meta = DefineStepMethodMeta<{
	Name: 'check'
	ExpectedThis: DefineExpectedValchecker
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Runs a custom check function on the value, allowing for type narrowing or validation.
	 *
	 * ---
	 *
	 * ### Example:
	 * #### type-guard
	 * ```ts
	 * import { createValchecker, check } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [check] })
	 * const schema = v.check((x): x is '123' => x === '123')
	 * const result = schema.execute('123')
	 * ```
	 *
	 * #### boolean-returning
	 * ```ts
	 * import { createValchecker, check } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [check] })
	 * const schema = v.check((x) => typeof x === 'number' && x > 0)
	 * const result = schema.execute(42)
	 * ```
	 *
	 * #### MaybePromise-returning
	 * ```ts
	 * import { createValchecker, check } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [check] })
	 * const schema = v.check(async (x) => {
	 *   await new Promise(res => setTimeout(res, 100))
	 *   return typeof x === 'string' && x.length > 3
	 * })
	 * const result = await schema.execute('hello')
	 * ```
	 *
	 * #### string-returning (for custom error message)
	 * ```ts
	 * import { createValchecker, check } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [check] })
	 * const schema = v.check((x) => typeof x === 'string' && x.length > 3 ? true : 'String must be longer than 3 characters')
	 * const result = schema.execute('hello')
	 * ```
	 *
	 * #### adding issues manually (advanced)
	 * ```ts
	 * import { createValchecker, check, object, number, string, min, max } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [check, object, string] })
	 * const schema = v.object({
	 *   prop1: v.string(),
	 * })
	 *   .check((obj, { addIssue }) => {
	 *     // Custom cross-property validation, custom path for issues
	 *     if (obj.prop1.length < 5) {
	 *       addIssue({
	 *         code: 'custom:prop1_too_short',
	 *         path: ['prop1'],
	 *         payload: { value: obj.prop1 },
	 *         message: `prop1 must be at least 5 characters long.`,
	 *       })
	 *     }
	 *   })
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'check:failed'`: The check function returned false, a string, or threw an error.
	 */
	check:
		| DefineStepMethod<
			Meta,
			this['This'] extends infer This extends Meta['ExpectedThis']
				?	[InferOutput<This>, InferIssue<This>] extends [infer CurrentOutput, infer CurrentIssue extends ExecutionIssue]
						?	<Output extends CurrentOutput>(
								run: (value: CurrentOutput, utils: Internal.RunCheckUtils<CurrentOutput, CurrentIssue>) => value is Output,
								message?: MessageHandler<Internal.Issue<CurrentOutput>>
							) => Next<
								{
									async: IsPromise<Output> extends false ? false : true
									output: Output
									issue: Internal.Issue<CurrentOutput> | InferIssue<This>
								},
								This
							>
						:	never
				:	never
		>
		| DefineStepMethod<
			Meta,
			this['This'] extends infer This extends Meta['ExpectedThis']
				? [InferOutput<This>, InferIssue<This>] extends [infer CurrentOutput, infer CurrentIssue extends ExecutionIssue]
						? <Result extends Internal.RunCheckResult>(
								run: Internal.RunCheck<CurrentOutput, CurrentIssue, Result>,
								message?: MessageHandler<Internal.Issue<CurrentOutput>>
							) => Next<
								{
									async: IsPromise<Result> extends false ? false : true
									output: Awaited<Result> extends (Internal.True<infer T> | false) ? T : CurrentOutput
									issue: Internal.Issue<CurrentOutput>
								},
								This
							>
						: never
				: never
		>
}

/* @__NO_SIDE_EFFECTS__ */
export const check = implStepPlugin<PluginDef>({
	check: ({
		utils: { addSuccessStep, success, resolveMessage, failure },
		params: [run, message],
	}) => {
		addSuccessStep((value) => {
			const handleError = (error: unknown) => {
				return failure({
					code: 'check:failed',
					payload: { value, error },
					message: resolveMessage(
						{
							code: 'check:failed',
							payload: { value, error },
						},
						message,
						'Check failed',
					),
				})
			}
			try {
				const issues: ExecutionIssue<any, any>[] = []
				const addIssue = (issue: ExecutionIssue) => issues.push(issue)
				const checkResult = run(value, {
					narrow: returnTrue as <T>() => Internal.True<T>,
					addIssue,
				})
				const processCheckResult = (result: Awaited<Internal.RunCheckResult>) => {
					if (result === false) {
						return failure({
							code: 'check:failed',
							payload: { value },
							message: resolveMessage(
								{
									code: 'check:failed',
									payload: { value },
								},
								message,
								'Check failed',
							),
						})
					}

					if (typeof result === 'string') {
						return failure({
							code: 'check:failed',
							payload: { value },
							message: resolveMessage(
								{
									code: 'check:failed',
									payload: { value },
								},
								message,
								result,
							),
						})
					}

					return issues.length > 0
						? failure(issues)
						: success(value)
				}
				return checkResult instanceof Promise
					?	checkResult
							.then(processCheckResult)
							.catch(err => handleError(err))
					:	processCheckResult(checkResult)
			}
			catch (error) {
				return handleError(error)
			}
		})
	},
})
