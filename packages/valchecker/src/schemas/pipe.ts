import type { DefineSchemaTypes, InferAsync, InferInput, InferOutput, ValidationResult, ValSchema } from '../core'
import type { Equal } from '../utils'
import { AbstractSchema, implementSchemaClass, isSuccessResult } from '../core'

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

export class PipeSchema<Steps extends ValSchema[]> extends AbstractSchema<PipeSchemaTypes<Steps>> {}

implementSchemaClass(
	PipeSchema,
	{
		validate: (value, { meta, success, createExecutionChain }) => {
			let chain = createExecutionChain().then<ValidationResult<unknown>>(() => success(value))
			const steps = meta.steps
			for (const step of steps) {
				chain = chain
					.then((result) => {
						if (isSuccessResult(result)) {
							return step.validate(result.value)
						}
						return result
					})
			}
			return chain
		},
	},
)

type FindFirstInvalidStep<Steps extends ValSchema[], LastStep extends ValSchema = never, Count extends 0[] = []> = Steps extends [infer First extends ValSchema, ...infer Rest extends ValSchema[]]
	? Equal<LastStep, never> extends true
		? FindFirstInvalidStep<Rest, First, [...Count, 0]>
		: InferOutput<LastStep> extends InferInput<First>
			? FindFirstInvalidStep<Rest, First, [...Count, 0]>
			: Count['length']
	: never

type MakePipeError<FirstInvalidStep extends number, ExpectedInput, Result extends ValSchema[] = []> = Result['length'] extends FirstInvalidStep
	? [...Result, ValSchema<ExpectedInput, unknown>, ...'Please fix the first invalid step.'[]]
	: MakePipeError<FirstInvalidStep, ExpectedInput, [...Result, ValSchema]>

type CheckSteps<Steps extends ValSchema[], FirstInvalidStep extends number = FindFirstInvalidStep<Steps>> = Equal<FirstInvalidStep, never> extends true
	? never
	: MakePipeError<FirstInvalidStep, InferOutput<[any, ...Steps][FirstInvalidStep]>>

export function pipe<Steps extends [ValSchema, ValSchema, ...ValSchema[]]>(
	...steps: Equal<CheckSteps<Steps>, never> extends true
		? [...Steps]
		: CheckSteps<Steps>
): PipeSchema<Steps> {
	return new PipeSchema({ meta: { steps: steps as Steps } })
}
