import type { DefineSchemaTypes, ExecutionIssue, ExecutionResult, SchemaMessage } from '../../core'
import type { IsPromise, MaybePromise } from '../../shared'
import { AbstractSchema, implementSchemaClass, isSuccess } from '../../core'
import { createObject, returnTrue } from '../../shared'

type True<T> = true & { readonly '~output': T }

interface RunCheckUtils<Input> {
	readonly narrow: <T extends Input>() => True<T>
	readonly addIssue: (issue: ExecutionIssue) => void
}

type RunCheckResult = MaybePromise<void | boolean | string | True<any>>

type RunCheck<Input = any, Result extends RunCheckResult = RunCheckResult> = (value: Input, utils: RunCheckUtils<Input>) => Result

type PipeStepCheckSchemaTypes<Input, Result extends RunCheckResult> = DefineSchemaTypes<{
	Async: IsPromise<Result>
	Meta: { run: RunCheck<Input, Result> }
	Input: ExecutionResult<Input>
	Output: Result extends MaybePromise<True<infer T>> ? T : Input
	IssueCode: 'CHECK_FAILED'
}>

type PipeStepCheckSchemaMessage<Input, Result extends RunCheckResult> = SchemaMessage<PipeStepCheckSchemaTypes<Input, Result>>

/* @__NO_SIDE_EFFECTS__ */
class PipeStepCheckSchema<Input, Result extends RunCheckResult> extends AbstractSchema<PipeStepCheckSchemaTypes<Input, Result>> {}

implementSchemaClass(
	PipeStepCheckSchema,
	{
		isTransformed: () => false,
		execute: (lastResult, { meta, success, failure, issue }) => {
			if (isSuccess(lastResult) === false)
				return lastResult

			const lastSuccessResult = lastResult
			const issues: ExecutionIssue[] = []
			const utils = createObject({
				narrow: returnTrue,
				addIssue: (issue: ExecutionIssue) => issues.push(issue),
			} as any as RunCheckUtils<any>)

			function processReturnValue(returnValue: Awaited<RunCheckResult>) {
				if (typeof returnValue === 'boolean') {
					return returnValue ? success(lastSuccessResult) : failure([...issues, issue('CHECK_FAILED')])
				}
				if (typeof returnValue === 'string') {
					return failure([...issues, issue('CHECK_FAILED', { message: returnValue })])
				}
				return issues.length === 0 ? success(lastSuccessResult) : failure(issues)
			}

			try {
				const returnValue = meta.run(lastResult.value, utils)
				if (returnValue instanceof Promise)
					return returnValue.then(processReturnValue).catch(error => failure([...issues, issue('CHECK_FAILED', { error })]))
				return processReturnValue(returnValue)
			}
			catch (error) {
				return failure([...issues, issue('CHECK_FAILED', { error })])
			}
		},
	},
)

/* @__NO_SIDE_EFFECTS__ */
function defineRunCheck<Input>(): ({ implement: <Run extends RunCheck<Input>>(run: Run) => Run }) {
	return {
		implement: run => run,
	}
}

export type {
	PipeStepCheckSchemaMessage,
	RunCheck,
	RunCheckResult,
	RunCheckUtils,
	True,
}

export {
	defineRunCheck,
	PipeStepCheckSchema,
}
