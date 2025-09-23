import type { DefineSchemaTypes, SchemaMessage } from '../../core'
import { AbstractSchema, implementSchemaClass } from '../../core'

type UndefinedSchemaTypes = DefineSchemaTypes<{
	Output: undefined
	IssueCode: 'EXPECTED_UNDEFINED'
}>

type UndefinedSchemaMessage = SchemaMessage<UndefinedSchemaTypes>

/* @__NO_SIDE_EFFECTS__ */
class UndefinedSchema extends AbstractSchema<UndefinedSchemaTypes> {}

implementSchemaClass(
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
