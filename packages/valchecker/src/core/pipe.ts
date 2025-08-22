import type { Equal } from '../utils'
import type { DefineSchemaTypes, InferAsync, InferInput, InferOutput, ValidationResult, ValSchema } from './schema'
import { AbstractSchema, implementSchemaClass } from './schema'

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

export class PipeSchema<Steps extends ValSchema[]> extends AbstractSchema<PipeSchemaTypes<Steps>> {
	// @ts-expect-error Too complex for TS to infer the output type correctly
	override step<NewStep extends PipeStepSchema<InferPipeOutput<Steps>, unknown>>(step: NewStep): PipeSchema<[...Steps, NewStep]> {
		this.meta.steps.push(step)
		return this as any
	}
}

implementSchemaClass(
	PipeSchema,
	{
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
