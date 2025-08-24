import type { Equal } from '../utils'
import type { DefineSchemaTypes, InferAsync, InferInput, InferOutput, ValidationResult, ValSchema } from './schema'
import { AbstractBaseSchema, implementSchemaClass, isSuccessResult } from './schema'

type PipeSchemaTypes<Steps extends ValSchema[]> = DefineSchemaTypes<{
	Async: InferPipeAsync<Steps>
	Meta: {
		steps: Steps
	}
	Input: InferPipeInput<Steps>
	Output: InferPipeOutput<Steps>
}>

type InferPipeInput<Steps extends ValSchema[]> = Steps extends [infer First extends ValSchema, ...any[]]
	? InferInput<First>
	: unknown

type InferPipeOutput<Steps extends ValSchema[]> = Steps extends [...any[], infer Last extends ValSchema]
	? InferOutput<Last>
	: unknown

type InferPipeAsync<Steps extends ValSchema[], T extends boolean = false> = Equal<T, true> extends true
	? true
	: Steps extends [infer Step extends ValSchema, ...infer Rest extends ValSchema[]]
		? InferPipeAsync<Rest, InferAsync<Step>>
		: T

export type PipeStepSchema<Input = unknown, Output = Input> = ValSchema<ValidationResult<Input>, Output>

type CheckFn<T, Async extends boolean> = (value: T) => (true extends Async ? Promise<boolean> : never) | (false extends Async ? boolean : never)

type CheckPipeStepSchemaTypes<Input, Async extends boolean> = DefineSchemaTypes<{
	Async: Async
	Meta: { fn: CheckFn<Input, Async> }
	Input: ValidationResult<Input>
	Output: Input
	IssueCode: 'CHECK_FAILED'
}>

export class CheckPipeStepSchema<Input, Async extends boolean> extends AbstractBaseSchema<CheckPipeStepSchemaTypes<Input, Async>> {}

implementSchemaClass(
	CheckPipeStepSchema,
	{
		validate: (lastResult, { meta, success, failure, createExecutionChain }) => {
			const chain = createExecutionChain()
			// If the last result is not successful, skip the check
			if (isSuccessResult(lastResult) === false)
				return chain.then(() => lastResult)

			return chain
				.then(() => meta.fn(lastResult.value))
				.then<ValidationResult<any>>((checkReturn) => {
					if (checkReturn === true)
						return success(lastResult.value)

					return failure('CHECK_FAILED')
				})
		},
	},
)

export class PipeSchema<Steps extends ValSchema[]> extends AbstractBaseSchema<PipeSchemaTypes<Steps>> {
	step<Output, NewStep extends PipeStepSchema<InferPipeOutput<Steps>, Output>>(step: NewStep): PipeSchema<[...Steps, NewStep]> {
		this.meta.steps.push(step)
		return this as any as PipeSchema<[...Steps, NewStep]>
	}

	check(fn: CheckFn<InferPipeOutput<Steps>, false>): PipeSchema<[...Steps, CheckPipeStepSchema<InferPipeOutput<Steps>, false>]>
	check(fn: CheckFn<InferPipeOutput<Steps>, true>): PipeSchema<[...Steps, CheckPipeStepSchema<InferPipeOutput<Steps>, true>]>
	check<Async extends boolean>(fn: CheckFn<InferPipeOutput<Steps>, Async>): any {
		this.meta.steps.push(new CheckPipeStepSchema({ meta: { fn } }) as any)
		return this
	}
}

implementSchemaClass(
	PipeSchema,
	{
		isTransformed: meta => meta.steps.some(step => step.isTransformed),
		validate: (value, { meta, success, createExecutionChain }) => {
			let chain = createExecutionChain().then<ValidationResult<unknown>>(() => success(value))
			const steps = meta.steps
			for (const step of steps) {
				chain = chain.then(result => step.validate(result))
			}
			return chain
		},
	},
)
