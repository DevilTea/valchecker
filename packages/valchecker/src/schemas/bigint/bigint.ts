import type { DefineSchemaTypes, SchemaMessage } from '../../core'
import { AbstractSchema, implementSchemaClass } from '../../core'

type BigintSchemaTypes = DefineSchemaTypes<{
	Output: bigint
	IssueCode: 'EXPECTED_BIGINT'
}>

type BigintSchemaMessage = SchemaMessage<BigintSchemaTypes>

class BigintSchema extends AbstractSchema<BigintSchemaTypes> {}

implementSchemaClass(
	BigintSchema,
	{
		defaultMessage: {
			EXPECTED_BIGINT: 'Expected bigint.',
		},
		validate: (value, { success, failure }) => typeof value === 'bigint'
			? success(value)
			: failure('EXPECTED_BIGINT'),
	},
)

/**
 * Creates a bigint schema.
 */
function bigint(message?: BigintSchemaMessage): BigintSchema {
	return new BigintSchema({ message })
}

export {
	bigint,
	BigintSchema,
}
