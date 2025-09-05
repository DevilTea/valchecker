import type { IsReturnPromise } from '../shared'
import type { DefineSchemaTypes, SchemaMessage, ValidationResult } from './base'
import { createExecutionChain, returnTrue } from '../shared'
import { AbstractBaseSchema, implementSchemaClass, isSuccessResult } from './base'

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

class PipeStepFallbackSchema<Fn extends FallbackFn> extends AbstractBaseSchema<PipeStepFallbackSchemaTypes<Fn>> {}

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
