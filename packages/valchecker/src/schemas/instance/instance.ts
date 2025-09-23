import type { DefineSchemaTypes, SchemaMessage } from '../../core'
import { AbstractSchema, implementSchemaClass } from '../../core'

type InstanceSchemaTypes<T> = DefineSchemaTypes<{
	Meta: { constructor_: new (...args: any[]) => T }
	Output: T
	IssueCode: 'INVALID_INSTANCE'
}>

type InstanceSchemaMessage<T> = SchemaMessage<InstanceSchemaTypes<T>>

/* @__NO_SIDE_EFFECTS__ */
class InstanceSchema<T> extends AbstractSchema<InstanceSchemaTypes<T>> {}

implementSchemaClass(
	InstanceSchema,
	{
		defaultMessage: {
			INVALID_INSTANCE: 'Invalid instance.',
		},
		execute: (value, { meta, success, failure }) => value instanceof meta.constructor_
			? success(value)
			: failure('INVALID_INSTANCE'),
	},
)

/* @__NO_SIDE_EFFECTS__ */
/**
 * Creates a instance schema.
 */
function instance<T>(constructor_: (new (...args: any[]) => T), message?: InstanceSchemaMessage<T>): InstanceSchema<T> {
	return new InstanceSchema({ meta: { constructor_ }, message })
}

export {
	instance,
	InstanceSchema,
}
