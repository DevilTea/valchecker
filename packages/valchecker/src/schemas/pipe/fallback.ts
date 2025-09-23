import type { DefineSchemaTypes, ExecutionFailureResult, ExecutionResult, SchemaMessage } from '../../core'
import type { MaybePromise } from '../../shared'
import { AbstractSchema, implementSchemaClass, isSuccessResult } from '../../core'
import { returnTrue } from '../../shared'

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
				return lastResult

			try {
				const fallbackValue = meta.run(lastResult)
				if (fallbackValue instanceof Promise)
					return fallbackValue.then(success).catch(error => failure(issue('FALLBACK_FAILED', { error })))
				return success(fallbackValue)
			}
			catch (error) {
				return failure(issue('FALLBACK_FAILED', { error }))
			}
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
