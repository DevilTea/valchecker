import type { DefineSchemaTypes } from '../../core'
import { AbstractSchema, implementSchemaClass } from '../../core'

type AnySchemaTypes = DefineSchemaTypes<{
	Output: any
}>

class AnySchema extends AbstractSchema<AnySchemaTypes> {}

implementSchemaClass(
	AnySchema,
	{
		execute: (value, { success }) => success(value),
	},
)

/**
 * Creates an any schema.
 */
function any(): AnySchema {
	return new AnySchema()
}

export {
	any,
	AnySchema,
}
