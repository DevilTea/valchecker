import type { DefineSchemaTypes, SchemaMessage } from '../../core'
import { AbstractSchema } from '../../core'

type UndefinedSchemaTypes = DefineSchemaTypes<{
	Output: undefined
	IssueCode: 'EXPECTED_UNDEFINED'
}>

type UndefinedSchemaMessage = SchemaMessage<UndefinedSchemaTypes>

class UndefinedSchema extends AbstractSchema<UndefinedSchemaTypes> {
	setup() {
		this.implementSchemaClass(
			UndefinedSchema,
			{
				defaultMessage: {
					EXPECTED_UNDEFINED: 'Expected undefined.',
				},
				execute: (value, { success, failure }) => value === void 0
					? success(value)
					: failure('EXPECTED_UNDEFINED'),
			},
		)
	}
}

/* @__NO_SIDE_EFFECTS__ */
/**
 * Creates an undefined schema.
 */
function undefined_(message?: UndefinedSchemaMessage): UndefinedSchema {
	return new UndefinedSchema({ message })
}

export {
	undefined_,
	UndefinedSchema,
}
