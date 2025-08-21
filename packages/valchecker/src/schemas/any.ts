import type { DefineSchemaTypes } from '../core'
import { AbstractSchema, implementSchemaClass } from '../core'

type AnySchemaTypes = DefineSchemaTypes<{
	Output: any
}>

export class AnySchema extends AbstractSchema<AnySchemaTypes> {}

implementSchemaClass(
	AnySchema,
	{
		validate: (value, { success }) => success(value),
	},
)

/**
 * Creates an any schema.
 */
export function any(): AnySchema {
	return new AnySchema()
}
