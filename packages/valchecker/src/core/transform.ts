import type { IsReturnPromise } from '../shared'
import type { DefineSchemaTypes, SchemaMessage, ValidationResult } from './base'
import { createExecutionChain, returnTrue } from '../shared'
import { AbstractBaseSchema, implementSchemaClass, isSuccessResult } from './base'

type TransformFn<Input = any> = (value: Input) => any

type PipeStepTransformSchemaTypes<Transform extends TransformFn> = DefineSchemaTypes<{
	Async: IsReturnPromise<Transform> extends false ? false : true
	Transformed: true
	Meta: { transform: Transform }
	Input: ValidationResult<Parameters<Transform>[0]>
	Output: Awaited<ReturnType<Transform>>
	IssueCode: 'TRANSFORM_FAILED'
}>

type PipeStepTransformSchemaMessage<Fn extends TransformFn> = SchemaMessage<PipeStepTransformSchemaTypes<Fn>>

class PipeStepTransformSchema<Fn extends TransformFn> extends AbstractBaseSchema<PipeStepTransformSchemaTypes<Fn>> {}

implementSchemaClass(
	PipeStepTransformSchema,
	{
		isTransformed: returnTrue,
		validate: (lastResult, { meta, success, failure, issue }) => {
			if (isSuccessResult(lastResult) === false)
				return createExecutionChain(lastResult)

			return createExecutionChain()
				.then(() => meta.transform(lastResult.value))
				.then<ValidationResult<any>, ValidationResult<any>>(
					transformed => success(transformed),
					error => failure(issue('TRANSFORM_FAILED', { error })),
				)
		},
	},
)

export type {
	PipeStepTransformSchemaMessage,
	TransformFn,
}

export {
	PipeStepTransformSchema,
}
