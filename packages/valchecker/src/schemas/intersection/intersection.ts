import type { DefineSchemaTypes, ExecutionIssue, InferAsync, InferOutput, UntransformedValSchema } from '../../core'
import type { Equal } from '../../shared'
import { AbstractSchema, implementSchemaClass, isSuccessResult } from '../../core'
import { createExecutionChain } from '../../shared'

type IntersectionSchemaTypes<Branches extends UntransformedValSchema[]> = DefineSchemaTypes<{
	Async: InferIntersectionAsync<Branches>
	Meta: {
		branches: Branches
	}
	Output: InferIntersectionOutput<Branches>
}>

type InferIntersectionAsync<Branches extends UntransformedValSchema[], T extends boolean = false> = Equal<T, true> extends true
	? true
	: Branches extends [infer Schema extends UntransformedValSchema, ...infer Rest extends UntransformedValSchema[]]
		? InferIntersectionAsync<Rest, InferAsync<Schema>>
		: T

type InferIntersectionOutput<Branches extends UntransformedValSchema[], T = never> = Branches extends [infer B extends UntransformedValSchema, ...infer Rest extends UntransformedValSchema[]]
	? InferIntersectionOutput<Rest, T & InferOutput<B>>
	: Equal<T, never> extends true
		? unknown
		: T

class IntersectionSchema<Branches extends UntransformedValSchema[]> extends AbstractSchema<IntersectionSchemaTypes<Branches>> {}

implementSchemaClass(
	IntersectionSchema,
	{
		isTransformed: ({ branches }) => branches.length > 0 && branches.some(branch => branch.isTransformed),
		execute: (value, { meta, success, failure }) => {
			const issues: ExecutionIssue[] = []
			let isValid = true
			let chain = createExecutionChain()
			for (const branch of meta.branches) {
				chain = chain.then(() => {
					// Early return if already invalid
					if (!isValid)
						return

					return createExecutionChain()
						.then(() => branch.execute(value))
						.then((result) => {
							if (!isSuccessResult(result)) {
								isValid = false
								issues.push(...result.issues)
							}
						})
				})
			}
			return chain.then(() => (isValid ? success(value) : failure(issues)))
		},
	},
)

/**
 * Creates a intersection schema.
 */
function intersection<Branches extends [UntransformedValSchema, UntransformedValSchema, ...UntransformedValSchema[]]>(...branches: [...Branches]): IntersectionSchema<Branches> {
	return new IntersectionSchema({ meta: { branches } })
}

export {
	intersection,
	IntersectionSchema,
}
