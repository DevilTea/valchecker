import type { DefineSchemaTypes, InferAsync, InferInput, InferOutput, ValSchema } from '../core'
import { AbstractSchema, implementSchemaClass } from '../core'

type LazySchemaTypes<T extends ValSchema> = DefineSchemaTypes<{
	Async: InferAsync<T>
	Meta: { getSchema: () => T }
	Input: InferInput<T>
	Output: InferOutput<T>
}>

export class LazySchema<T extends ValSchema> extends AbstractSchema<LazySchemaTypes<T>> {}

implementSchemaClass(
	LazySchema,
	{
		validate: (value, { meta, createExecutionChain }) => createExecutionChain().then(() => meta.getSchema().validate(value)),
	},
)

/**
 * Creates a lazy schema.
 */
export function lazy<T extends ValSchema>(getSchema: () => T): LazySchema<T> {
	return new LazySchema({ meta: { getSchema } })
}
