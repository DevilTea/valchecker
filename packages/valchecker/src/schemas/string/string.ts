import type { DefineSchemaTypes, SchemaMessage } from '../../core'
import { AbstractSchema, implementSchemaClass } from '../../core'

type StringSchemaTypes = DefineSchemaTypes<{
	Output: string
	IssueCode: 'EXPECTED_STRING'
}>

type StringSchemaMessage = SchemaMessage<StringSchemaTypes>

class StringSchema extends AbstractSchema<StringSchemaTypes> {}

implementSchemaClass(
	StringSchema,
	{
		defaultMessage: {
			EXPECTED_STRING: 'Expected string.',
		},
		validate: (value, { success, failure }) => typeof value === 'string'
			? success(value)
			: failure('EXPECTED_STRING'),
	},
)

/**
 * Creates a string schema.
 */
function string(message?: StringSchemaMessage): StringSchema {
	return new StringSchema({ message })
}

export {
	string,
	StringSchema,
}
