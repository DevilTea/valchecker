import type { DefineSchemaTypes, SchemaMessage, ValidationResult } from '../../core'
import type { IsReturnPromise } from '../../shared'
import { AbstractSchema, implementSchemaClass, isSuccessResult } from '../../core'
import { createExecutionChain, returnTrue } from '../../shared'

type FallbackFn<T = any> = () => T | Promise<T>

type PipeStepFallbackSchemaTypes<Fallback extends FallbackFn> = DefineSchemaTypes<{
	Async: IsReturnPromise<Fallback> extends false ? false : true
	Transformed: true
	Meta: { fallback: Fallback }
	Input: ValidationResult<Awaited<ReturnType<Fallback>>>
	Output: Awaited<ReturnType<Fallback>>
	IssueCode: 'FALLBACK_FAILED'
}>

type PipeStepFallbackSchemaMessage<Fn extends FallbackFn> = SchemaMessage<PipeStepFallbackSchemaTypes<Fn>>

class PipeStepFallbackSchema<Fn extends FallbackFn> extends AbstractSchema<PipeStepFallbackSchemaTypes<Fn>> {}

implementSchemaClass(
	PipeStepFallbackSchema,
	{
		isTransformed: returnTrue,
		validate: (lastResult, { meta, success, failure, issue }) => {
			if (isSuccessResult(lastResult))
				return createExecutionChain(lastResult)

			return createExecutionChain()
				.then(() => meta.fallback())
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
