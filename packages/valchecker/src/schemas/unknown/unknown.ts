import type { DefineSchemaTypes } from '../../core'
import { AbstractSchema, implementSchemaClass } from '../../core'

type UnknownSchemaTypes = DefineSchemaTypes<{
	Output: unknown
}>

/* @__NO_SIDE_EFFECTS__ */
class UnknownSchema extends AbstractSchema<UnknownSchemaTypes> {}

implementSchemaClass(
	UnknownSchema,
	{
		execute: (value, { success }) => success(value),
	},
)

/* @__NO_SIDE_EFFECTS__ */
/**
 * Creates an unknown schema.
 */
function unknown(): UnknownSchema {
	return new UnknownSchema()
}

export {
	unknown,
	UnknownSchema,
}
