import type { DefineSchemaTypes, ExecutionIssue, ExecutionResult, InferAsync, InferOutput, ValSchema } from '../../core'
import type { Equal } from '../../shared'
import { AbstractSchema, implementSchemaClass, isSuccess } from '../../core'

type UntransformedValSchema = ValSchema<{ Transformed: false }>

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

			function processResult(result: ExecutionResult<any>) {
				if (isSuccess(result)) {
					return
				}
				issues.push(...result.issues)
			}

			let promise: Promise<void> | null = null
			for (const branch of meta.branches) {
				const result = branch.execute(value)
				if (promise == null) {
					// Early return if already invalid
					if (issues.length > 0)
						break

					if (result instanceof Promise)
						promise = result.then(processResult)
					else
						processResult(result)
				}
				else {
					promise = promise.then(() => issues.length > 0
						// Early return if already invalid
						? void 0
						: Promise.resolve(result).then(processResult))
				}
			}
			return promise == null
				? (issues.length === 0 ? success(value) : failure(issues))
				: promise.then(() => issues.length === 0 ? success(value) : failure(issues))
		},
	},
)

/* @__NO_SIDE_EFFECTS__ */
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
