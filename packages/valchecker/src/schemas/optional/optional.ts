import type { DefineSchemaTypes, InferAsync, InferInput, InferOutput, InferTransformed, ValSchema } from '../../core'
import { AbstractSchema, implementSchemaClass } from '../../core'

type OptionalSchemaTypes<Schema extends ValSchema> = DefineSchemaTypes<{
	Async: InferAsync<Schema>
	Transformed: InferTransformed<Schema>
	Meta: {
		schema: Schema
	}
	Input: InferInput<Schema>
	Output: InferOutput<Schema> | undefined
}>

class OptionalSchema<Schema extends ValSchema = ValSchema> extends AbstractSchema<OptionalSchemaTypes<Schema>> {
	setup() {
		implementSchemaClass(
			OptionalSchema,
			{
				isTransformed: meta => meta.schema.isTransformed,
				execute: (value, { meta, success }) => {
					if (value === void 0) {
						return success(value)
					}

					return meta.schema.execute(value)
				},
			},
		)
	}
}

type UnwrapOptional<Schema extends ValSchema> = Schema extends OptionalSchema<infer InnerSchema extends ValSchema> ? InnerSchema : Schema

/* @__NO_SIDE_EFFECTS__ */
function unwrapOptional<Schema extends ValSchema>(schema: Schema): UnwrapOptional<Schema> {
	if (schema instanceof OptionalSchema) {
		return schema.meta.schema
	}
	return schema as UnwrapOptional<Schema>
}

/* @__NO_SIDE_EFFECTS__ */
function optional<Schema extends ValSchema>(schema: Schema): OptionalSchema<UnwrapOptional<Schema>> {
	return new OptionalSchema({ meta: { schema: unwrapOptional(schema) } })
}

export type {
	UnwrapOptional,
}

export {
	optional,
	OptionalSchema,
	unwrapOptional,
}
