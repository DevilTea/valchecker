import type { DefineSchemaTypes, ExecutionResult, InferAsync, InferInput, InferOutput, InferTransformed, ValSchema } from '../../core'
import { AbstractSchema, implementSchemaClass, isSuccessResult } from '../../core'

type PipeStepRunSchemaTypes<Schema extends ValSchema> = DefineSchemaTypes<{
	Async: InferAsync<Schema>
	Transformed: InferTransformed<Schema>
	Meta: { schema: Schema }
	Input: ExecutionResult<InferInput<Schema>>
	Output: InferOutput<Schema>
}>

class PipeStepRunSchema<Schema extends ValSchema> extends AbstractSchema<PipeStepRunSchemaTypes<Schema>> {}

implementSchemaClass(
	PipeStepRunSchema,
	{
		isTransformed: meta => meta.schema.isTransformed,
		execute: (lastResult, { meta }) => {
			if (isSuccessResult(lastResult) === false)
				return lastResult

			return meta.schema.execute(lastResult.value)
		},
	},
)

export {
	PipeStepRunSchema,
}
