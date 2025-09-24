import type { DefineSchemaTypes, InferAsync, InferInput, InferOutput, ValSchema } from '../../core'
import { AbstractSchema } from '../../core'

type LazySchemaTypes<T extends ValSchema> = DefineSchemaTypes<{
	Async: InferAsync<T>
	Meta: { getSchema: () => T }
	Input: InferInput<T>
	Output: InferOutput<T>
}>

class LazySchema<T extends ValSchema> extends AbstractSchema<LazySchemaTypes<T>> {
	setup() {
		this.implementSchemaClass(
			LazySchema,
			{
				execute: (value, { meta }) => meta.getSchema().execute(value),
			},
		)
	}
}

/* @__NO_SIDE_EFFECTS__ */
/**
 * Creates a lazy schema.
 */
function lazy<T extends ValSchema>(getSchema: () => T): LazySchema<T> {
	return new LazySchema({ meta: { getSchema } })
}

export {
	lazy,
	LazySchema,
}
