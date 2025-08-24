import type { DefineSchemaTypes, ValidationResult } from '../core'
import type { MaybePromise } from '../utils'
import { AbstractBaseSchema, implementSchemaClass, isSuccessResult } from '../core'

type CheckFn<T = any> = (value: T) => MaybePromise<boolean | string>

type CheckPipeStepSchemaTypes<Input, Fn extends CheckFn<Input>> = DefineSchemaTypes<{
	Async: ReturnType<Fn> extends Promise<any> ? true : false
	Meta: { fn: Fn }
	Input: ValidationResult<Input>
	Output: Input
	IssueCode: 'CHECK_FAILED'
}>

export class CheckPipeStepSchema<Input, Fn extends CheckFn<Input>> extends AbstractBaseSchema<CheckPipeStepSchemaTypes<Input, Fn>> {}

implementSchemaClass(
	CheckPipeStepSchema,
	{
		validate: (lastResult, { meta, success, failure, issue, createExecutionChain }) => {
			const chain = createExecutionChain()
			if (isSuccessResult(lastResult)) {
				return chain
					.then(() => meta.fn(lastResult.value))
					.then<ValidationResult<any>>((checkReturn) => {
						if (checkReturn === true)
							return success(lastResult.value)

						if (typeof checkReturn === 'string')
							return failure(issue('CHECK_FAILED', { message: checkReturn }))

						return failure(issue('CHECK_FAILED'))
					})
			}
			return chain.then(() => lastResult)
		},
	},
)

export function check<Input, Fn extends CheckFn<Input>>(fn: Fn): CheckPipeStepSchema<Input, Fn> {
	return new CheckPipeStepSchema({ meta: { fn } })
}
