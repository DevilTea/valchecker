import type { DefineSchemaTypes, SchemaMessage, ValidationIssue, ValidationResult } from '../../core'
import type { IsPromise, MaybePromise } from '../../shared'
import { AbstractSchema, implementSchemaClass, isSuccessResult } from '../../core'
import { createExecutionChain, createObject, returnTrue } from '../../shared'

type True<T> = true & { readonly '~output': T }

interface RunCheckUtils<Input> {
	readonly narrow: <T extends Input>() => True<T>
	readonly addIssue: (issue: ValidationIssue) => void
}

type RunCheckResult = MaybePromise<void | boolean | string | True<any>>

type RunCheck<Input = any, Result extends RunCheckResult = RunCheckResult> = (value: Input, utils: RunCheckUtils<Input>) => Result

type PipeStepCheckSchemaTypes<Input, Result extends RunCheckResult> = DefineSchemaTypes<{
	Async: IsPromise<Result>
	Meta: { run: RunCheck<Input, Result> }
	Input: ValidationResult<Input>
	Output: Result extends MaybePromise<True<infer T>> ? T : Input
	IssueCode: 'CHECK_FAILED'
}>

type PipeStepCheckSchemaMessage<Input, Result extends RunCheckResult> = SchemaMessage<PipeStepCheckSchemaTypes<Input, Result>>

class PipeStepCheckSchema<Input, Result extends RunCheckResult> extends AbstractSchema<PipeStepCheckSchemaTypes<Input, Result>> {}

implementSchemaClass(
	PipeStepCheckSchema,
	{
		isTransformed: () => false,
		validate: (lastResult, { meta, success, failure, issue }) => {
			if (isSuccessResult(lastResult) === false)
				return createExecutionChain(lastResult)

			const issues: ValidationIssue[] = []
			const utils = createObject({
				narrow: returnTrue,
				addIssue: (issue: ValidationIssue) => issues.push(issue),
			} as any as RunCheckUtils<any>)
			return createExecutionChain()
				.then(() => meta.run(lastResult.value, utils))
				.then<ValidationResult<any>, ValidationResult<any>>(
					(result) => {
						if (typeof result === 'boolean') {
							return result ? success(lastResult.value) : failure([...issues, issue('CHECK_FAILED')])
						}
						if (typeof result === 'string') {
							return failure([...issues, issue('CHECK_FAILED', { message: result })])
						}
						return issues.length === 0 ? success(lastResult.value) : failure(issues)
					},
					error => failure([...issues, issue('CHECK_FAILED', { error })]),
				)
		},
	},
)

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
