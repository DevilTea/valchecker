import type { Valchecker } from '../../core/valchecker'
import type { IsPromise, MaybePromise } from '../../shared'
import { expectNever, returnTrue } from '../../shared'

type True<T> = true & { readonly '~output': T }

export interface RunCheckUtils<Input> {
	readonly narrow: <T extends Input>() => True<T>
	readonly addIssue: (issue: Valchecker.ExecutionIssue) => void
}

type RunCheckResult = MaybePromise<void | boolean | True<any> | string | Valchecker.ExecutionIssue | Valchecker.ExecutionIssue[]>

declare module '../../core/valchecker' {

	export interface Valchecker {
		check: Valchecker.DefineSchemaMethod<
			{
				pluginId: 'core:check'
				condition: { schemaContext: Valchecker.TSchemaContext }
				issueCode: 'CUSTOM_CHECK_FAILED'
				patch: never
			},
			(
				// Overload for type guard
				<LastOutput extends Valchecker.InferOutput<this>, CheckOutput extends LastOutput>(fn: (value: LastOutput, utils: RunCheckUtils<LastOutput>) => value is CheckOutput) => Valchecker.NextStep<
					this,
					'check',
					{ output: CheckOutput }
				>
			) & (
				<LastOutput extends Valchecker.InferOutput<this>, CheckResult extends RunCheckResult>(fn: (value: LastOutput, utils: RunCheckUtils<LastOutput>) => CheckResult) => Valchecker.NextStep<
					this,
					'check',
					{
						async: IsPromise<CheckResult>
						output: CheckResult extends MaybePromise<True<infer T>> ? T : LastOutput
					}
				>
			)
		>
	}
}

export const check = {
	id: 'core:check',
	implement: {
		schemaMethods: {
			check: ({ addSuccessStep, success, failure, issue }, fn) => addSuccessStep(
				(v) => {
					try {
						const issues: Valchecker.ExecutionIssue[] = []
						const result: RunCheckResult = fn(v, {
							narrow: returnTrue as any,
							addIssue: (issue) => { issues.push(issue) },
						})

						function processResult(result: Awaited<RunCheckResult>) {
							if (typeof result === 'boolean') {
								return result
									? success(v)
									: failure([...issues, issue('CUSTOM_CHECK_FAILED')])
							}

							if (typeof result === 'string')
								return failure([...issues, issue('CUSTOM_CHECK_FAILED', { message: result })])

							if (result)
								return failure([result].flat())

							if (result === void 0)
								return issues.length === 0 ? success(v) : failure(issues)

							return expectNever(result)
						}

						return result instanceof Promise
							? result.then(processResult).catch(error => failure(issue('CUSTOM_CHECK_FAILED', { error })))
							: processResult(result)
					}
					catch (error) {
						return failure(issue('CUSTOM_CHECK_FAILED', { error }))
					}
				},
			),
		},
	},
} satisfies Valchecker.Plugin<'core:check'>
