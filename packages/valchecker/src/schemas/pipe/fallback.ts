import type { DefineSchemaTypes, SchemaMessage, ValidationFailureResult, ValidationResult } from '../../core'
import type { MaybePromise } from '../../shared'
import { AbstractSchema, implementSchemaClass, isSuccessResult } from '../../core'
import { createExecutionChain, returnTrue } from '../../shared'

type FallbackFn<T = any> = (failure: ValidationFailureResult) => MaybePromise<T>

type PipeStepFallbackSchemaTypes<Output, Async extends boolean> = DefineSchemaTypes<{
	Async: Async
	Transformed: true
	Meta: { run: FallbackFn<Output> }
	Input: ValidationResult<Output>
	Output: Output
	IssueCode: 'FALLBACK_FAILED'
}>

type PipeStepFallbackSchemaMessage<Output, Async extends boolean> = SchemaMessage<PipeStepFallbackSchemaTypes<Output, Async>>

class PipeStepFallbackSchema<Output, Async extends boolean> extends AbstractSchema<PipeStepFallbackSchemaTypes<Output, Async>> {}

implementSchemaClass(
	PipeStepFallbackSchema,
	{
		isTransformed: returnTrue,
		validate: (lastResult, { meta, success, failure, issue }) => {
			if (isSuccessResult(lastResult))
				return createExecutionChain(lastResult)

			return createExecutionChain()
				.then(() => meta.run(lastResult))
				.then<ValidationResult<any>, ValidationResult<any>>(
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
