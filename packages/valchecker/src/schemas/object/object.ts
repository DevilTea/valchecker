import type { DefineSchemaTypes, ExecutionIssue, ExecutionResult, InferAsync, InferOutput, SchemaMessage, ValSchema } from '../../core'
import type { Simplify } from '../../shared'
import type { OptionalSchema } from '../optional'
import { AbstractSchema, implementSchemaClass, isSuccessResult, prependIssuePath } from '../../core'
import { createExecutionChain } from '../../shared'

type ObjectSchemaTypes<O extends Record<PropertyKey, ValSchema>> = DefineSchemaTypes<{
	Async: InferObjectAsync<O>
	Meta: { struct: O }
	Output: InferObjectOutput<O>
	IssueCode: 'EXPECTED_OBJECT'
}>

type ObjectSchemaMessage<O extends Record<PropertyKey, ValSchema>> = SchemaMessage<ObjectSchemaTypes<O>>

type InferObjectAsync<O extends Record<PropertyKey, ValSchema>> = {
	[K in keyof O]: InferAsync<O[K]>
}[keyof O] extends false ? false : true

type InferObjectOutput<O extends Record<PropertyKey, ValSchema>> = Simplify<{
	[K in keyof O as O[K] extends OptionalSchema ? K : never]?: InferOutput<O[K]>
} & {
	[K in keyof O as O[K] extends OptionalSchema ? never : K]: InferOutput<O[K]>
}>

class ObjectSchema<O extends Record<PropertyKey, ValSchema>> extends AbstractSchema<ObjectSchemaTypes<O>> {}

implementSchemaClass(
	ObjectSchema,
	{
		defaultMessage: {
			EXPECTED_OBJECT: 'Expected an object.',
		},
		isTransformed: ({ struct }) => Object.values(struct).some(schema => schema.isTransformed),
		execute: (value, { meta, isTransformed, success, failure }) => {
			if (typeof value !== 'object' || value == null || Array.isArray(value))
				return failure('EXPECTED_OBJECT')

			const output: Record<PropertyKey, any> = isTransformed
				? Object.defineProperties({}, Object.getOwnPropertyDescriptors(value))
				: value
			const issues: ExecutionIssue[] = []
			const struct = meta.struct
			const keys = Reflect.ownKeys(struct)
			let chain = createExecutionChain()
			for (const key of keys) {
				const itemSchema = struct[key]!
				const itemValue = (value as any)[key]
				chain = chain
					.then(() => itemSchema.execute(itemValue))
					.then((result) => {
						if (isSuccessResult(result)) {
							if (isTransformed) {
								(output as any)[key] = result.value
							}
							return
						}

						issues.push(...result.issues.map(issue => prependIssuePath(issue, [key])))
					})
			}
			return chain.then<ExecutionResult<Record<PropertyKey, any>>>(() => issues.length === 0 ? success(output) : failure(issues))
		},
	},
)

function object<O extends Record<PropertyKey, ValSchema>>(struct: O, message?: ObjectSchemaMessage<O>): ObjectSchema<O> {
	return new ObjectSchema({ meta: { struct }, message })
}

export {
	object,
	ObjectSchema,
}
