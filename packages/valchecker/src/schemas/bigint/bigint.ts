import type { DefineSchemaTypes, SchemaMessage } from '../../core'
import { AbstractSchema } from '../../core'

type BigintSchemaTypes = DefineSchemaTypes<{
	Output: bigint
	IssueCode: 'EXPECTED_BIGINT'
}>

type BigintSchemaMessage = SchemaMessage<BigintSchemaTypes>

class BigintSchema extends AbstractSchema<BigintSchemaTypes> {
	setup() {
		this.implementSchemaClass(
			BigintSchema,
			{
				defaultMessage: {
					EXPECTED_BIGINT: 'Expected bigint.',
				},
				execute: (value, { success, failure }) => typeof value === 'bigint'
					? success(value)
					: failure('EXPECTED_BIGINT'),
			},
		)
	}
}

/* @__NO_SIDE_EFFECTS__ */
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
