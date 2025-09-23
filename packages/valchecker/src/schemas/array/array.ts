import type { DefineSchemaTypes, ExecutionIssue, ExecutionResult, InferAsync, InferOutput, InferTransformed, SchemaMessage, ValSchema } from '../../core'
import { AbstractSchema, implementSchemaClass, isSuccess, prependIssuePath } from '../../core'

type ArraySchemaTypes<T extends ValSchema> = DefineSchemaTypes<{
	Async: InferAsync<T>
	Transformed: InferTransformed<T>
	Meta: { item: T }
	Output: InferOutput<T>[]
	IssueCode: 'EXPECTED_ARRAY'
}>

type ArraySchemaMessage<T extends ValSchema> = SchemaMessage<ArraySchemaTypes<T>>

/* @__NO_SIDE_EFFECTS__ */
class ArraySchema<T extends ValSchema> extends AbstractSchema<ArraySchemaTypes<T>> {}

implementSchemaClass(
	ArraySchema,
	{
		isTransformed: meta => meta.item.isTransformed,
		defaultMessage: {
			EXPECTED_ARRAY: 'Expected an array.',
		},
		execute: (value, { meta, isTransformed, success, failure }) => {
			if (!Array.isArray(value))
				return failure('EXPECTED_ARRAY')

			const output = isTransformed ? Array.from(value) : value
			const issues: ExecutionIssue[] = []
			const itemSchema = meta.item

			function processResult(result: ExecutionResult<any>, index: number) {
				if (isSuccess(result)) {
					if (isTransformed) {
						output[index] = result.value
					}
					return
				}
				issues.push(...result.issues.map(issue => prependIssuePath(issue, [index])))
			}

			let promise: Promise<void> | null = null
			for (let i = 0; i < output.length; i++) {
				const item = output[i]
				const result = itemSchema.execute(item)

				if (promise == null) {
					if (result instanceof Promise)
						promise = result.then(result => processResult(result, i))
					else
						processResult(result, i)
				}
				else {
					promise = promise.then(() => result).then(result => processResult(result, i))
				}
			}
			return promise == null
				? (issues.length === 0 ? success(output) : failure(issues))
				: promise.then(() => issues.length === 0 ? success(output) : failure(issues))
		},
	},
)

/* @__NO_SIDE_EFFECTS__ */
function array<T extends ValSchema>(item: T, message?: ArraySchemaMessage<T>): ArraySchema<T> {
	return new ArraySchema({ meta: { item }, message })
}

export {
	array,
	ArraySchema,
}
