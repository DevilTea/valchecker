import type { DefineSchemaTypes, ExecutionResult, SchemaMessage } from '../../core'
import type { IsPromise } from '../../shared'
import { AbstractSchema, implementSchemaClass, isSuccessResult } from '../../core'
import { createExecutionChain, returnTrue } from '../../shared'

type RunTransform<Input = any, Result = any> = (value: Input) => Result

type PipeStepTransformSchemaTypes<Input, Result> = DefineSchemaTypes<{
	Async: IsPromise<Result>
	Transformed: true
	Meta: { run: RunTransform<Input, Result> }
	Input: ExecutionResult<Input>
	Output: Awaited<Result>
	IssueCode: 'TRANSFORM_FAILED'
}>

type PipeStepTransformSchemaMessage<Input, Result> = SchemaMessage<PipeStepTransformSchemaTypes<Input, Result>>

class PipeStepTransformSchema<Input, Result> extends AbstractSchema<PipeStepTransformSchemaTypes<Input, Result>> {}

implementSchemaClass(
	PipeStepTransformSchema,
	{
		isTransformed: returnTrue,
		execute: (lastResult, { meta, success, failure, issue }) => {
			if (isSuccessResult(lastResult) === false)
				return createExecutionChain(lastResult)

			return createExecutionChain()
				.then(() => meta.run(lastResult.value))
				.then<ExecutionResult<any>, ExecutionResult<any>>(
					transformed => success(transformed),
					error => failure(issue('TRANSFORM_FAILED', { error })),
				)
		},
	},
)

function defineRunTransform<Input>(): ({ implement: <Run extends RunTransform<Input>>(run: Run) => Run }) {
	return {
		implement: run => run,
	}
}

export type {
	PipeStepTransformSchemaMessage,
	RunTransform,
}

export {
	defineRunTransform,
	PipeStepTransformSchema,
}
