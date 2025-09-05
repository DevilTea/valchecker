import type { DefineSchemaTypes } from '../../core'
import { AbstractSchema, implementSchemaClass } from '../../core'

type UnknownSchemaTypes = DefineSchemaTypes<{
	Output: unknown
}>

class UnknownSchema extends AbstractSchema<UnknownSchemaTypes> {}

implementSchemaClass(
	UnknownSchema,
	{
		validate: (value, { success }) => success(value),
	},
)

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
