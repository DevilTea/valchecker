import type { DefineSchemaTypes, SchemaMessage } from '../core'
import { AbstractSchema, implementSchemaClass } from '../core'

type BooleanSchemaTypes = DefineSchemaTypes<{
	Output: boolean
	IssueCode: 'EXPECTED_BOOLEAN'
}>

type BooleanSchemaMessage = SchemaMessage<BooleanSchemaTypes>

export class BooleanSchema extends AbstractSchema<BooleanSchemaTypes> {}

implementSchemaClass(
	BooleanSchema,
	{
		defaultMessage: {
			EXPECTED_BOOLEAN: 'Expected boolean.',
		},
		validate: (value, { success, failure }) => typeof value === 'boolean'
			? success(value)
			: failure('EXPECTED_BOOLEAN'),
	},
)

/**
 * Creates a boolean schema.
 */
export function boolean(message?: BooleanSchemaMessage): BooleanSchema {
	return new BooleanSchema({ message })
}
