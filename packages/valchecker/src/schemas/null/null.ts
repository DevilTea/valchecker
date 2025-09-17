import type { DefineSchemaTypes, SchemaMessage } from '../../core'
import { AbstractSchema, implementSchemaClass } from '../../core'

type NullSchemaTypes = DefineSchemaTypes<{
	Output: null
	IssueCode: 'EXPECTED_NULL'
}>

type NullSchemaMessage = SchemaMessage<NullSchemaTypes>

class NullSchema extends AbstractSchema<NullSchemaTypes> {}

implementSchemaClass(
	NullSchema,
	{
		defaultMessage: {
			EXPECTED_NULL: 'Expected null.',
		},
		execute: (value, { success, failure }) => value === null
			? success(value)
			: failure('EXPECTED_NULL'),
	},
)

/**
 * Creates a null schema.
 */
function null_(message?: NullSchemaMessage): NullSchema {
	return new NullSchema({ message })
}

export {
	null_,
	NullSchema,
}
