import type { DefineSchemaTypes, ExecutionIssue, ExecutionResult, InferAsync, InferOutput, SchemaMessage, ValSchema } from '../../core'
import type { Equal, Simplify } from '../../shared'
import type { OptionalSchema } from '../optional'
import { AbstractSchema, implementSchemaClass, isSuccessResult, prependIssuePath } from '../../core'
import { createExecutionChain } from '../../shared'

type ObjectSchemaModes = 'default' | 'loose' | 'strict'

type ObjectSchemaTypes<Struct extends Record<PropertyKey, ValSchema>, Mode extends ObjectSchemaModes> = DefineSchemaTypes<{
	Async: InferObjectAsync<Struct>
	Meta: { struct: Struct, mode: Mode }
	Output: InferObjectOutput<Struct, Mode>
	IssueCode: 'EXPECTED_OBJECT' | (Equal<Mode, 'strict'> extends true ? 'UNEXPECTED_KEY' : never)
}>

type ObjectSchemaMessage<O extends Record<PropertyKey, ValSchema>, Mode extends ObjectSchemaModes> = SchemaMessage<ObjectSchemaTypes<O, Mode>>

type InferObjectAsync<O extends Record<PropertyKey, ValSchema>> = {
	[K in keyof O]: InferAsync<O[K]>
}[keyof O] extends false ? false : true

type InferObjectOutput<O extends Record<PropertyKey, ValSchema>, Mode extends ObjectSchemaModes> = Simplify<{
	[K in keyof O as O[K] extends OptionalSchema ? K : never]?: InferOutput<O[K]>
} & {
	[K in keyof O as O[K] extends OptionalSchema ? never : K]: InferOutput<O[K]>
} & (
	Equal<Mode, 'loose'> extends true ? Record<PropertyKey, unknown> : unknown
)>

class ObjectSchema<O extends Record<PropertyKey, ValSchema>, Mode extends ObjectSchemaModes> extends AbstractSchema<ObjectSchemaTypes<O, Mode>> {}

implementSchemaClass(
	ObjectSchema,
	{
		defaultMessage: {
			EXPECTED_OBJECT: 'Expected an object.',
			UNEXPECTED_KEY: 'Key is not expected.',
		},
		isTransformed: ({ struct }) => Object.values(struct).some(schema => schema.isTransformed),
		execute: (value, { meta, isTransformed, success, failure }) => {
			if (typeof value !== 'object' || value == null || Array.isArray(value))
				return failure('EXPECTED_OBJECT')

			const mode = meta.mode
			const struct = meta.struct
			const knownKeys = new Set(Reflect.ownKeys(struct))

			if (mode === 'strict') {
				for (const key of Reflect.ownKeys(value)) {
					if (!knownKeys.has(key))
						return failure('UNEXPECTED_KEY')
				}
			}

			const issues: ExecutionIssue[] = []
			const output: Record<PropertyKey, any> = mode === 'loose'
				? isTransformed
					? Object.defineProperties({}, Object.getOwnPropertyDescriptors(value))
					: value
				: {}
			let chain = createExecutionChain()
			for (const key of knownKeys) {
				const itemSchema = struct[key]!
				const itemValue = (value as any)[key]
				chain = chain
					.then(() => itemSchema.execute(itemValue))
					.then((result) => {
						if (isSuccessResult(result)) {
							if ((mode === 'loose') && (isTransformed === false))
								return
							output[key] = result.value
							return
						}

						issues.push(...result.issues.map(issue => prependIssuePath(issue, [key])))
					})
			}
			return chain.then<ExecutionResult<Record<PropertyKey, any>>>(() => issues.length === 0 ? success(output) : failure(issues))
		},
	},
)

function object<O extends Record<PropertyKey, ValSchema>>(struct: O, message?: ObjectSchemaMessage<O, 'default'>): ObjectSchema<O, 'default'> {
	return new ObjectSchema({ meta: { struct, mode: 'default' }, message })
}

function looseObject<O extends Record<PropertyKey, ValSchema>>(struct: O, message?: ObjectSchemaMessage<O, 'loose'>): ObjectSchema<O, 'loose'> {
	return new ObjectSchema({ meta: { struct, mode: 'loose' }, message })
}

function strictObject<O extends Record<PropertyKey, ValSchema>>(struct: O, message?: ObjectSchemaMessage<O, 'strict'>): ObjectSchema<O, 'strict'> {
	return new ObjectSchema({ meta: { struct, mode: 'strict' }, message })
}

export {
	looseObject,
	object,
	ObjectSchema,
	strictObject,
}
