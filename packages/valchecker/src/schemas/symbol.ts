import type { DefineSchemaTypes, SchemaMessage } from '../core'
import { AbstractSchema, implementSchemaClass } from '../core'

type SymbolSchemaTypes = DefineSchemaTypes<{
	Output: symbol
	IssueCode: 'EXPECTED_SYMBOL'
}>

type SymbolSchemaMessage = SchemaMessage<SymbolSchemaTypes>

export class SymbolSchema extends AbstractSchema<SymbolSchemaTypes> {}

implementSchemaClass(
	SymbolSchema,
	{
		defaultMessage: {
			EXPECTED_SYMBOL: 'Expected symbol.',
		},
		validate: (value, { success, failure }) => typeof value === 'symbol'
			? success(value)
			: failure('EXPECTED_SYMBOL'),
	},
)

/**
 * Creates a symbol schema.
 */
export function symbol(message?: SymbolSchemaMessage): SymbolSchema {
	return new SymbolSchema({ message })
}
