import type { DefineSchemaTypes, InferAsync, InferInput, InferOutput, InferTransformed, ValSchema } from '../../core'
import { AbstractBaseSchema, implementSchemaClass } from '../../core'

type AvailableModifiers = 'optional'

type WithModifierSchemaTypes<Schema extends ValSchema, Modifier extends AvailableModifiers> = DefineSchemaTypes<{
	Async: InferAsync<Schema>
	Transformed: InferTransformed<Schema>
	Meta: {
		schema: Schema
		modifier: Modifier
	}
	Input: InferInput<Schema>
	Output: Modifier extends 'optional'
		? InferOutput<Schema> | undefined
		: InferOutput<Schema>
}>

class WithModifierSchema<Schema extends ValSchema, Modifier extends AvailableModifiers> extends AbstractBaseSchema<WithModifierSchemaTypes<Schema, Modifier>> {}

implementSchemaClass(
	WithModifierSchema,
	{
		isTransformed: ({ schema }) => schema.isTransformed,
		validate: (value, { meta: { schema, modifier }, success }) => {
			if (modifier === 'optional' && value === void 0) {
				return success(value)
			}

			return schema.validate(value)
		},
	},
)

function isWithModifierSchema(schema: ValSchema): schema is WithModifierSchema<ValSchema, AvailableModifiers> {
	return schema instanceof WithModifierSchema
}

type UnwrappedWithModifierSchema<Schema extends ValSchema> = Schema extends WithModifierSchema<infer InnerSchema extends ValSchema, any> ? InnerSchema : Schema

function unwrapWithModifierSchema<Schema extends ValSchema>(schema: Schema): UnwrappedWithModifierSchema<Schema> {
	if (isWithModifierSchema(schema)) {
		return schema.meta.schema as UnwrappedWithModifierSchema<Schema>
	}
	return schema as UnwrappedWithModifierSchema<Schema>
}

function optional<Schema extends ValSchema>(schema: Schema): WithModifierSchema<UnwrappedWithModifierSchema<Schema>, 'optional'> {
	return new WithModifierSchema({
		meta: {
			// If the schema is already a WithModifierSchema, unwrap it to avoid nesting
			schema: isWithModifierSchema(schema)
				? schema.meta.schema
				: schema,
			modifier: 'optional',
		},
	})
}

type OptionalValSchema = WithModifierSchema<any, 'optional'>

function isOptionalValSchema(schema: ValSchema): schema is OptionalValSchema {
	return schema instanceof WithModifierSchema && schema.meta.modifier === 'optional'
}

export type {
	OptionalValSchema,
	UnwrappedWithModifierSchema,
}

export {
	isOptionalValSchema,
	isWithModifierSchema,
	optional,
	unwrapWithModifierSchema,
	WithModifierSchema,
}
