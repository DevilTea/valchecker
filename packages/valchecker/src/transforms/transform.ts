import type { DefineSchemaTypes, ValidationResult } from '../core'
import type { MaybePromise } from '../utils'
import { AbstractSchema, implementSchemaClass, isSuccessResult } from '../core'

type TransformFn = (value: unknown) => MaybePromise<boolean | string>

type TransformPipeStepSchemaTypes<Fn extends TransformFn> = DefineSchemaTypes<{
	Async: ReturnType<Fn> extends Promise<any> ? true : false
	Meta: { fn: Fn }
	Input: ValidationResult<Parameters<Fn>[0]>
	Output: Parameters<Fn>[0]
	IssueCode: 'TRANSFORM_FAILED'
}>

export class TransformPipeStepSchema<Fn extends TransformFn> extends AbstractSchema<TransformPipeStepSchemaTypes<Fn>> {}

const isTransformed = () => true

implementSchemaClass(
	TransformPipeStepSchema,
	{
		isTransformed,
		validate: (lastResult, { meta, success, failure, issue, createExecutionChain }) => {
			const chain = createExecutionChain()
			if (isSuccessResult(lastResult)) {
				return chain
					.then(() => meta.fn(lastResult.value))
					.then<ValidationResult<any>>((checkReturn) => {
						if (checkReturn === true)
							return success(lastResult.value)

						if (typeof checkReturn === 'string')
							return failure(issue('TRANSFORM_FAILED', { message: checkReturn }))

						return failure(issue('TRANSFORM_FAILED'))
					})
			}
			return chain.then(() => lastResult)
		},
	},
)

export function transform<Fn extends TransformFn>(fn: Fn): TransformPipeStepSchema<Fn> {
	return new TransformPipeStepSchema({ meta: { fn } })
}
