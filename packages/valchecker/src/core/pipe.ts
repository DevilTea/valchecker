import type { AnyFn, ExecutionChain } from '../shared'
import type { DefineSchemaTypes, InferAsync, InferInput, InferOutput, InferTransformed, ValidationResult, ValSchema } from './base'
import type { CheckFn, PipeStepCheckSchemaMessage } from './check'
import type { FallbackFn, PipeStepFallbackSchemaMessage } from './fallback'
import type { PipeStepTransformSchemaMessage, TransformFn } from './transform'
import { createExecutionChain } from '../shared'
import { AbstractBaseSchema, implementSchemaClass } from './base'
import { PipeStepCheckSchema } from './check'
import { PipeStepFallbackSchema } from './fallback'
import { PipeStepTransformSchema } from './transform'

type PipeStepValSchema = ValSchema<ValidationResult<any>, any>
type PipeSteps = [ValSchema, ...PipeStepValSchema[]]

type PipeSchemaTypes<Steps extends PipeSteps> = DefineSchemaTypes<{
	Async: InferPipeAsync<Steps>
	Transformed: InferPipeTransformed<Steps>
	Meta: {
		steps: Steps
	}
	Input: InferPipeInput<Steps>
	Output: InferPipeOutput<Steps>
}>

type InferPipeInput<Steps extends PipeSteps> = Steps extends [infer First extends ValSchema, ...any[]]
	? InferInput<First>
	: unknown

type InferPipeOutput<Steps extends PipeSteps> = Steps extends [...any[], infer Last extends ValSchema]
	? InferOutput<Last>
	: unknown

type InferPipeAsync<Steps extends PipeSteps> = InferAsync<Steps[number]> extends false ? false : true

type InferPipeTransformed<Steps extends PipeSteps> = InferTransformed<Steps[number]> extends false ? false : true

class PipeSchema<Steps extends PipeSteps> extends AbstractBaseSchema<PipeSchemaTypes<Steps>> {
	check<
		Check extends CheckFn<InferPipeOutput<Steps>>,
	>(
		check: Check,
		message?: PipeStepCheckSchemaMessage<Check>,
	): PipeSchema<[...Steps, PipeStepCheckSchema<Check>]> {
		this.meta.steps.push(new PipeStepCheckSchema({ meta: { check }, message }) satisfies PipeStepValSchema)
		return this as any
	}

	transform<Transform extends TransformFn<InferPipeOutput<Steps>>>(
		transform: Transform,
		message?: PipeStepTransformSchemaMessage<Transform>,
	): PipeSchema<[...Steps, PipeStepTransformSchema<Transform>]> {
		this.meta.steps.push(new PipeStepTransformSchema({ meta: { transform }, message }) satisfies PipeStepValSchema)
		return this as any
	}

	fallback<
		Output extends InferPipeOutput<Steps>,
		Fallback extends (Output extends AnyFn ? FallbackFn<Output> : (Output | Promise<Output> | FallbackFn<Output>)),
		_Fallback extends FallbackFn<Output> = () => (Fallback extends AnyFn ? ReturnType<Fallback> : Fallback),
	>(
		fallback: Fallback,
		message?: PipeStepFallbackSchemaMessage<_Fallback>,
	): PipeSchema<[...Steps, PipeStepFallbackSchema<_Fallback>]> {
		const _fallback = (typeof fallback === 'function' ? fallback : () => fallback) as any as _Fallback
		this.meta.steps.push(new PipeStepFallbackSchema({ meta: { fallback: _fallback }, message }) satisfies PipeStepValSchema)
		return this as any
	}
}

implementSchemaClass(
	PipeSchema,
	{
		isTransformed: meta => meta.steps.some(step => step.isTransformed),
		validate: (value, { meta }) => {
			const [source, ...rest] = meta.steps
			let chain = createExecutionChain(source.validate(value)) as ExecutionChain<ValidationResult<any>>
			for (const step of rest) {
				chain = chain.then(result => step.validate(result))
			}
			return chain
		},
	},
)

export {
	PipeSchema,
}
