import type { DefineSchemaTypes, ExecutionFailureResult, ExecutionResult, SchemaMessage } from '../../core'
import type { MaybePromise } from '../../shared'
import { AbstractSchema, implementSchemaClass, isSuccessResult } from '../../core'
import { createExecutionChain, returnTrue } from '../../shared'

type FallbackFn<T = any> = (failure: ExecutionFailureResult) => MaybePromise<T>

type PipeStepFallbackSchemaTypes<Output, Async extends boolean> = DefineSchemaTypes<{
	Async: Async
	Transformed: true
	Meta: { run: FallbackFn<Output> }
	Input: ExecutionResult<Output>
	Output: Output
	IssueCode: 'FALLBACK_FAILED'
}>

type PipeStepFallbackSchemaMessage<Output, Async extends boolean> = SchemaMessage<PipeStepFallbackSchemaTypes<Output, Async>>

class PipeStepFallbackSchema<Output, Async extends boolean> extends AbstractSchema<PipeStepFallbackSchemaTypes<Output, Async>> {}

implementSchemaClass(
	PipeStepFallbackSchema,
	{
		isTransformed: returnTrue,
		execute: (lastResult, { meta, success, failure, issue }) => {
			if (isSuccessResult(lastResult))
				return createExecutionChain(lastResult)

			return createExecutionChain()
				.then(() => meta.run(lastResult))
				.then<ExecutionResult<any>, ExecutionResult<any>>(
					fallbackValue => success(fallbackValue),
					error => failure(issue('FALLBACK_FAILED', { error })),
				)
		},
	},
)

export type {
	FallbackFn,
	PipeStepFallbackSchemaMessage,
}

export {
	PipeStepFallbackSchema,
}
