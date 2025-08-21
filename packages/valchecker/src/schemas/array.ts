import type { DefineSchemaTypes, InferAsync, InferOutput, SchemaMessage, ValidationIssue, ValidationResult, ValSchema } from '../core'
import { AbstractSchema, implementSchemaClass, isSuccessResult, prependIssuePath } from '../core'

type ArraySchemaTypes<T extends ValSchema> = DefineSchemaTypes<{
	Async: InferAsync<T>
	Meta: { item: T }
	Output: InferOutput<T>[]
	IssueCode: 'EXPECTED_ARRAY'
}>

type ArraySchemaMessage<T extends ValSchema> = SchemaMessage<ArraySchemaTypes<T>>

export class ArraySchema<T extends ValSchema> extends AbstractSchema<ArraySchemaTypes<T>> {}

implementSchemaClass(
	ArraySchema,
	{
		defaultMessage: {
			EXPECTED_ARRAY: 'Expected an array.',
		},
		validate: (value, { meta, success, failure, createExecutionChain }) => {
			if (!Array.isArray(value))
				return failure('EXPECTED_ARRAY')

			const issues: ValidationIssue[] = []
			const itemSchema = meta.item
			let chain = createExecutionChain()
			for (let i = 0; i < value.length; i++) {
				const item = value[i]
				chain = chain
					.then(() => itemSchema.validate(item))
					.then((result) => {
						if (isSuccessResult(result))
							return

						issues.push(...result.issues.map(issue => prependIssuePath(issue, [i])))
					})
			}
			return chain.then<ValidationResult<any[]>>(() => issues.length === 0 ? success(value) : failure(issues))
		},
	},
)

export function array<T extends ValSchema>(item: T, message?: ArraySchemaMessage<T>): ArraySchema<T> {
	return new ArraySchema({ meta: { item }, message })
}
