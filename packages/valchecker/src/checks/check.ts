import type { DefineSchemaTypes, ValidationResult } from '../core'
import type { MaybePromise } from '../utils'
import { AbstractSchema, implementSchemaClass, isSuccessResult } from '../core'

type CheckFn = (value: unknown) => MaybePromise<boolean | string>

type CheckPipeStepSchemaTypes<Fn extends CheckFn> = DefineSchemaTypes<{
	Async: ReturnType<Fn> extends Promise<any> ? true : false
	Meta: { fn: Fn }
	Input: ValidationResult<Parameters<Fn>[0]>
	Output: Parameters<Fn>[0]
	IssueCode: 'CHECK_FAILED'
}>

export class CheckPipeStepSchema<Fn extends CheckFn> extends AbstractSchema<CheckPipeStepSchemaTypes<Fn>> {}

implementSchemaClass(
	CheckPipeStepSchema,
	{
		validate: (lastResult, { meta, success, failure, issue, createExecutionChain }) => {
			const chain = createExecutionChain()
			if (isSuccessResult(lastResult)) {
				return chain
					.then(() => meta.fn(lastResult.value))
					.then((checkReturn) => {
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

export function check<Fn extends CheckFn>(fn: Fn): CheckPipeStepSchema<Fn> {
	return new CheckPipeStepSchema({ meta: { fn } })
}
