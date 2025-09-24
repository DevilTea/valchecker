import type { DefineSchemaTypes } from '../../core'
import { AbstractSchema } from '../../core'

type UnknownSchemaTypes = DefineSchemaTypes<{
	Output: unknown
}>

class UnknownSchema extends AbstractSchema<UnknownSchemaTypes> {
	setup() {
		this.implementSchemaClass(
			UnknownSchema,
			{
				execute: (value, { success }) => success(value),
			},
		)
	}
}

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
