import type { DefineSchemaTypes, ExecutionResult, SchemaMessage } from '../../core'
import type { IsPromise } from '../../shared'
import { AbstractSchema, implementSchemaClass, isSuccessResult } from '../../core'
import { returnTrue } from '../../shared'

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

/* @__NO_SIDE_EFFECTS__ */
class PipeStepTransformSchema<Input, Result> extends AbstractSchema<PipeStepTransformSchemaTypes<Input, Result>> {}

implementSchemaClass(
	PipeStepTransformSchema,
	{
		isTransformed: returnTrue,
		execute: (lastResult, { meta, success, failure, issue }) => {
			if (isSuccessResult(lastResult) === false)
				return lastResult

			try {
				const transformed = meta.run(lastResult.value)
				if (transformed instanceof Promise)
					return transformed.then(success).catch(error => failure(issue('TRANSFORM_FAILED', { error })))
				return success(transformed)
			}
			catch (error) {
				return failure(issue('TRANSFORM_FAILED', { error }))
			}
		},
	},
)

/* @__NO_SIDE_EFFECTS__ */
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
