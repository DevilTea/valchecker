import type { DefineSchemaTypes, ExecutionIssue, ExecutionResult, InferAsync, InferOutput, SchemaMessage, ValSchema } from '../../core'
import type { Equal, Simplify } from '../../shared'
import type { OptionalSchema } from '../optional'
import { AbstractSchema, isSuccess, prependIssuePath } from '../../core'

type ObjectSchemaStruct = Record<PropertyKey, ValSchema>
type ObjectSchemaModes = 'default' | 'loose' | 'strict'

type ObjectSchemaTypes<Struct extends ObjectSchemaStruct, Mode extends ObjectSchemaModes> = DefineSchemaTypes<{
	Async: InferObjectAsync<Struct>
	Meta: { struct: Struct, mode: Mode }
	Output: InferObjectOutput<Struct, Mode>
	IssueCode: 'EXPECTED_OBJECT' | (Equal<Mode, 'strict'> extends true ? 'UNEXPECTED_KEY' : never)
}>

type ObjectSchemaMessage<Struct extends ObjectSchemaStruct, Mode extends ObjectSchemaModes> = SchemaMessage<ObjectSchemaTypes<Struct, Mode>>

type InferObjectAsync<Struct extends ObjectSchemaStruct> = {
	[K in keyof Struct]: InferAsync<Struct[K]>
}[keyof Struct] extends false ? false : true

type InferObjectOutput<Struct extends ObjectSchemaStruct, Mode extends ObjectSchemaModes> = Simplify<{
	[K in keyof Struct as Struct[K] extends OptionalSchema ? K : never]?: InferOutput<Struct[K]>
} & {
	[K in keyof Struct as Struct[K] extends OptionalSchema ? never : K]: InferOutput<Struct[K]>
} & (
	Equal<Mode, 'loose'> extends true ? Record<PropertyKey, unknown> : unknown
)>

class ObjectSchema<Struct extends ObjectSchemaStruct, Mode extends ObjectSchemaModes> extends AbstractSchema<ObjectSchemaTypes<Struct, Mode>> {
	setup() {
		this.implementSchemaClass(
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

					function processResult(result: ExecutionResult<any>, key: string | symbol) {
						if (isSuccess(result)) {
							if ((mode === 'loose') && (isTransformed === false))
								return
							output[key] = result.value
							return
						}
						issues.push(...result.issues.map(issue => prependIssuePath(issue, [key])))
					}

					let promise: Promise<void> | null = null
					for (const key of knownKeys) {
						const itemSchema = struct[key]!
						const item = (value as any)[key]
						const result = itemSchema.execute(item)
						if (promise == null) {
							if (result instanceof Promise)
								promise = result.then(result => processResult(result, key))
							else
								processResult(result, key)
						}
						else {
							promise = promise.then(() => result).then(result => processResult(result, key))
						}
					}
					return promise == null
						? (issues.length === 0 ? success(output) : failure(issues))
						: promise.then(() => issues.length === 0 ? success(output) : failure(issues))
				},
			},
		)
	}
}

/* @__NO_SIDE_EFFECTS__ */
/**
 * Creates an object schema. (Extra keys are ignored.)
 */
function object<Struct extends ObjectSchemaStruct>(struct: Struct, message?: ObjectSchemaMessage<Struct, 'default'>): ObjectSchema<Struct, 'default'> {
	return new ObjectSchema({ meta: { struct, mode: 'default' }, message })
}

/* @__NO_SIDE_EFFECTS__ */
/**
 * Creates a loose object schema. (Extra keys are kept.)
 */
function looseObject<Struct extends ObjectSchemaStruct>(struct: Struct, message?: ObjectSchemaMessage<Struct, 'loose'>): ObjectSchema<Struct, 'loose'> {
	return new ObjectSchema({ meta: { struct, mode: 'loose' }, message })
}

/* @__NO_SIDE_EFFECTS__ */
/**
 * Creates a strict object schema. (Extra keys are not allowed.)
 */
function strictObject<Struct extends ObjectSchemaStruct>(struct: Struct, message?: ObjectSchemaMessage<Struct, 'strict'>): ObjectSchema<Struct, 'strict'> {
	return new ObjectSchema({ meta: { struct, mode: 'strict' }, message })
}

export {
	looseObject,
	object,
	ObjectSchema,
	strictObject,
}
