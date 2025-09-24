import type { DefineSchemaTypes, SchemaMessage } from '../../core'
import { AbstractSchema, implementSchemaClass } from '../../core'

type NeverSchemaTypes = DefineSchemaTypes<{
	Output: never
	IssueCode: 'EXPECTED_NEVER'
}>

type NeverSchemaMessage = SchemaMessage<NeverSchemaTypes>

class NeverSchema extends AbstractSchema<NeverSchemaTypes> {}

implementSchemaClass(
	NeverSchema,
	{
		defaultMessage: {
			EXPECTED_NEVER: 'Expected never.',
		},
		execute: (_value, { failure }) => failure('EXPECTED_NEVER'),
	},
)

/* @__NO_SIDE_EFFECTS__ */
/**
 * Creates a never schema.
 */
function never(message?: NeverSchemaMessage): NeverSchema {
	return new NeverSchema({ message })
}

export {
	never,
	NeverSchema,
}
