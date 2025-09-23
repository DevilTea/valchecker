import type { DefineSchemaTypes } from '../../core'
import { AbstractSchema, implementSchemaClass } from '../../core'

type AnySchemaTypes = DefineSchemaTypes<{
	Output: any
}>

/* @__NO_SIDE_EFFECTS__ */
class AnySchema extends AbstractSchema<AnySchemaTypes> {}

implementSchemaClass(
	AnySchema,
	{
		execute: (value, { success }) => success(value),
	},
)

/* @__NO_SIDE_EFFECTS__ */
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
