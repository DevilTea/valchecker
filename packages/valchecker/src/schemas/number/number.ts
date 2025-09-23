import type { DefineSchemaTypes, SchemaMessage } from '../../core'
import { AbstractSchema, implementSchemaClass } from '../../core'

type NumberSchemaTypes = DefineSchemaTypes<{
	Meta: { allowNaN: boolean }
	Output: number
	IssueCode: 'EXPECTED_NUMBER'
}>

type NumberSchemaMessage = SchemaMessage<NumberSchemaTypes>

/* @__NO_SIDE_EFFECTS__ */
class NumberSchema extends AbstractSchema<NumberSchemaTypes> {}

implementSchemaClass(
	NumberSchema,
	{
		defaultMessage: {
			EXPECTED_NUMBER: 'Expected number.',
		},
		execute: (value, { meta, success, failure }) => (
			(typeof value === 'number' && meta.allowNaN)
			|| (typeof value === 'number' && !Number.isNaN(value))
		)
			? success(value)
			: failure('EXPECTED_NUMBER'),
	},
)

/* @__NO_SIDE_EFFECTS__ */
/**
 * Creates a number schema. (Not allows NaN)
 */
function number(message?: NumberSchemaMessage): NumberSchema
/**
 * Creates a number schema. (accepts NaN if `allowNaN` is true)
 */
function number(allowNaN: boolean, message?: NumberSchemaMessage): NumberSchema
function number(
	...params:
		| [message?: NumberSchemaMessage]
		| [allowNaN: boolean, message?: NumberSchemaMessage]
): NumberSchema {
	return new NumberSchema((() => {
		if (params.length === 0)
			return { meta: { allowNaN: false } }

		if (typeof params[0] === 'boolean') {
			return { meta: { allowNaN: params[0] }, message: params[1] }
		}

		return { meta: { allowNaN: false }, message: params[0] }
	})())
}

export {
	number,
	NumberSchema,
}
