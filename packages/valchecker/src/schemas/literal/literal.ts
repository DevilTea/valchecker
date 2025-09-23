import type { DefineSchemaTypes, SchemaMessage } from '../../core'
import { AbstractSchema, implementSchemaClass } from '../../core'

type LiteralSchemaTypes<L extends string | number | boolean | bigint | symbol> = DefineSchemaTypes<{
	Meta: { value: L }
	Output: L
	IssueCode: 'INVALID_LITERAL'
}>

type LiteralSchemaMessage<L extends string | number | boolean | bigint | symbol> = SchemaMessage<LiteralSchemaTypes<L>>

/* @__NO_SIDE_EFFECTS__ */
class LiteralSchema<L extends string | number | boolean | bigint | symbol> extends AbstractSchema<LiteralSchemaTypes<L>> {}

implementSchemaClass(
	LiteralSchema,
	{
		defaultMessage: {
			INVALID_LITERAL: 'Invalid value.',
		},
		execute: (value, { meta, success, failure }) => {
			if (Number.isNaN(meta.value)) {
				return Number.isNaN(value)
					? success(value as any)
					: failure('INVALID_LITERAL')
			}

			return value === meta.value
				? success(value as any)
				: failure('INVALID_LITERAL')
		},
	},
)

/* @__NO_SIDE_EFFECTS__ */
/**
 * Creates a literal schema.
 */
function literal<L extends string | number | boolean | bigint | symbol>(value: L, message?: LiteralSchemaMessage<L>): LiteralSchema<L> {
	return new LiteralSchema({ meta: { value }, message })
}

export {
	literal,
	LiteralSchema,
}
