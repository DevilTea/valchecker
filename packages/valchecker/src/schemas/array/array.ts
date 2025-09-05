import type { DefineSchemaTypes, InferAsync, InferOutput, SchemaMessage, ValidationIssue, ValidationResult, ValSchema } from '../../core'
import { AbstractSchema, implementSchemaClass, isSuccessResult, prependIssuePath } from '../../core'
import { createExecutionChain } from '../../shared'

type ArraySchemaTypes<T extends ValSchema> = DefineSchemaTypes<{
	Async: InferAsync<T>
	Meta: { item: T }
	Output: InferOutput<T>[]
	IssueCode: 'EXPECTED_ARRAY'
}>

type ArraySchemaMessage<T extends ValSchema> = SchemaMessage<ArraySchemaTypes<T>>

class ArraySchema<T extends ValSchema> extends AbstractSchema<ArraySchemaTypes<T>> {}

implementSchemaClass(
	ArraySchema,
	{
		isTransformed: meta => meta.item.isTransformed,
		defaultMessage: {
			EXPECTED_ARRAY: 'Expected an array.',
		},
		validate: (value, { meta, isTransformed, success, failure }) => {
			if (!Array.isArray(value))
				return failure('EXPECTED_ARRAY')

			const _value = isTransformed ? Array.from(value) : value
			const issues: ValidationIssue[] = []
			const itemSchema = meta.item
			let chain = createExecutionChain()
			for (let i = 0; i < _value.length; i++) {
				const item = _value[i]
				chain = chain
					.then(() => itemSchema.validate(item))
					.then((result) => {
						if (isSuccessResult(result)) {
							if (isTransformed) {
								_value[i] = result.value
							}
							return
						}
						issues.push(...result.issues.map(issue => prependIssuePath(issue, [i])))
					})
			}
			return chain.then<ValidationResult<any[]>>(() => issues.length === 0 ? success(_value) : failure(issues))
		},
	},
)

function array<T extends ValSchema>(item: T, message?: ArraySchemaMessage<T>): ArraySchema<T> {
	return new ArraySchema({ meta: { item }, message })
}

export {
	array,
	ArraySchema,
}
