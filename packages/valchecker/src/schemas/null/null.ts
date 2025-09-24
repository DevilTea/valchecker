import type { DefineSchemaTypes, SchemaMessage } from '../../core'
import { AbstractSchema } from '../../core'

type NullSchemaTypes = DefineSchemaTypes<{
	Output: null
	IssueCode: 'EXPECTED_NULL'
}>

type NullSchemaMessage = SchemaMessage<NullSchemaTypes>

class NullSchema extends AbstractSchema<NullSchemaTypes> {
	setup() {
		this.implementSchemaClass(
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
	}
}

/* @__NO_SIDE_EFFECTS__ */
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
