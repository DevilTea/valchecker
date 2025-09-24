import type { DefineSchemaTypes, SchemaMessage } from '../../core'
import { AbstractSchema } from '../../core'

type BooleanSchemaTypes = DefineSchemaTypes<{
	Output: boolean
	IssueCode: 'EXPECTED_BOOLEAN'
}>

type BooleanSchemaMessage = SchemaMessage<BooleanSchemaTypes>

class BooleanSchema extends AbstractSchema<BooleanSchemaTypes> {
	setup() {
		this.implementSchemaClass(
			BooleanSchema,
			{
				defaultMessage: {
					EXPECTED_BOOLEAN: 'Expected boolean.',
				},
				execute: (value, { success, failure }) => typeof value === 'boolean'
					? success(value)
					: failure('EXPECTED_BOOLEAN'),
			},
		)
	}
}

/* @__NO_SIDE_EFFECTS__ */
/**
 * Creates a boolean schema.
 */
function boolean(message?: BooleanSchemaMessage): BooleanSchema {
	return new BooleanSchema({ message })
}

export {
	boolean,
	BooleanSchema,
}
