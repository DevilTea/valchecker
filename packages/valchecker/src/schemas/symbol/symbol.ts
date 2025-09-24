import type { DefineSchemaTypes, SchemaMessage } from '../../core'
import { AbstractSchema } from '../../core'

type SymbolSchemaTypes = DefineSchemaTypes<{
	Output: symbol
	IssueCode: 'EXPECTED_SYMBOL'
}>

type SymbolSchemaMessage = SchemaMessage<SymbolSchemaTypes>

class SymbolSchema extends AbstractSchema<SymbolSchemaTypes> {
	setup() {
		this.implementSchemaClass(
			SymbolSchema,
			{
				defaultMessage: {
					EXPECTED_SYMBOL: 'Expected symbol.',
				},
				execute: (value, { success, failure }) => typeof value === 'symbol'
					? success(value)
					: failure('EXPECTED_SYMBOL'),
			},
		)
	}
}

/* @__NO_SIDE_EFFECTS__ */
/**
 * Creates a symbol schema.
 */
function symbol(message?: SymbolSchemaMessage): SymbolSchema {
	return new SymbolSchema({ message })
}

export {
	symbol,
	SymbolSchema,
}
