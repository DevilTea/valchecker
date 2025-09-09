import type { DefineSchemaTypes, SchemaMessage, ValidationIssue, ValidationResult } from '../../core'
import type { IsReturnPromise } from '../../shared'
import { AbstractSchema, implementSchemaClass, isSuccessResult } from '../../core'
import { createExecutionChain, createObject, returnTrue } from '../../shared'

type True<T> = true & { readonly '~output': T }

interface CheckFnUtils<Input> {
	readonly narrow: <T extends Input>() => True<T>
	readonly addIssue: (issue: ValidationIssue) => void
}

type CheckFn<Input = any> = (value: Input, utils: CheckFnUtils<Input>) => void | boolean | string | True<any> | Promise<void> | Promise<boolean> | Promise<string> | Promise<True<any>>

type InferPipeStepCheckSchemaOutput<Fn extends CheckFn, Input = Parameters<Fn>[0]> = Fn extends ((value: any) => value is infer Output)
	? Output
	: Exclude<Awaited<ReturnType<Fn>>, false | string> extends True<infer Output extends Input>
		? Output
		: Input

type PipeStepCheckSchemaTypes<Check extends CheckFn> = DefineSchemaTypes<{
	Async: IsReturnPromise<Check> extends false ? false : true
	Meta: { check: Check }
	Input: ValidationResult<Parameters<Check>[0]>
	Output: InferPipeStepCheckSchemaOutput<Check>
	IssueCode: 'CHECK_FAILED'
}>

type PipeStepCheckSchemaMessage<Fn extends CheckFn> = SchemaMessage<PipeStepCheckSchemaTypes<Fn>>

class PipeStepCheckSchema<Fn extends CheckFn> extends AbstractSchema<PipeStepCheckSchemaTypes<Fn>> {}

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
			} as any as CheckFnUtils<any>)
			return createExecutionChain()
				.then(() => meta.check(lastResult.value, utils))
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

export type {
	CheckFn,
	PipeStepCheckSchemaMessage,
}

export {
	PipeStepCheckSchema,
}
