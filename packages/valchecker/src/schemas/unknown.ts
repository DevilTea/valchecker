import type { DefineSchemaTypes } from '../core'
import { AbstractSchema, implementSchemaClass } from '../core'

type UnknownSchemaTypes = DefineSchemaTypes<{
	Output: unknown
}>

export class UnknownSchema extends AbstractSchema<UnknownSchemaTypes> {}

implementSchemaClass(
	UnknownSchema,
	{
		validate: (value, { success }) => success(value),
	},
)

/**
 * Creates an unknown schema.
 */
export function unknown(): UnknownSchema {
	return new UnknownSchema()
}
