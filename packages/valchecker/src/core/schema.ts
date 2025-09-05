import type { AnyFn } from '../shared'
import type { InferInput, InferOutput, SchemaTypes, ValSchema } from './base'
import type { CheckFn, PipeStepCheckSchema, PipeStepCheckSchemaMessage } from './check'
import type { FallbackFn, PipeStepFallbackSchema, PipeStepFallbackSchemaMessage } from './fallback'
import type { PipeStepTransformSchema, PipeStepTransformSchemaMessage, TransformFn } from './transform'
import { AbstractBaseSchema } from './base'
import { PipeSchema } from './pipe'

type AsValSchema<T extends ValSchema | AbstractBaseSchema> = T extends ValSchema ? T : ValSchema<InferInput<T>, InferOutput<T>>

/**
 * Abstract schema class with chainable pipe methods.
 */
abstract class AbstractSchema<T extends SchemaTypes = any> extends AbstractBaseSchema<T> {
	check<
		Check extends CheckFn<T['output']>,
	>(
		check: Check,
		message?: PipeStepCheckSchemaMessage<Check>,
	): PipeSchema<[AsValSchema<this>, PipeStepCheckSchema<Check>]> {
		return new PipeSchema({ meta: { steps: [this as AsValSchema<this>] } }).check(check, message) as any
	}

	transform<Transform extends TransformFn<T['output']>>(
		transform: Transform,
		message?: PipeStepTransformSchemaMessage<Transform>,
	): PipeSchema<[AsValSchema<this>, PipeStepTransformSchema<Transform>]> {
		return new PipeSchema({ meta: { steps: [this as AsValSchema<this>] } }).transform(transform, message) as any
	}

	fallback<
		Output extends T['output'],
		Fallback extends (Output extends AnyFn ? FallbackFn<Output> : (Output | Promise<Output> | FallbackFn<Output>)),
		_Fallback extends FallbackFn<Output> = () => (Fallback extends AnyFn ? ReturnType<Fallback> : Fallback),
	>(
		fallback: Fallback,
		message?: PipeStepFallbackSchemaMessage<_Fallback>,
	): PipeSchema<[AsValSchema<this>, PipeStepFallbackSchema<_Fallback>]> {
		return new PipeSchema({ meta: { steps: [this as AsValSchema<this>] } }).fallback(fallback, message) as any
	}
}

export {
	AbstractSchema,
}
