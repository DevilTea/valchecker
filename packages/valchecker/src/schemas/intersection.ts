import type { DefineSchemaTypes, InferAsync, InferOutput, ValidationIssue, ValSchema } from '../core'
import type { Equal } from '../utils'
import { AbstractSchema, implementSchemaClass, isSuccessResult } from '../core'

type IntersectionSchemaTypes<Branches extends ValSchema[]> = DefineSchemaTypes<{
	Async: InferIntersectionAsync<Branches>
	Meta: {
		branches: Branches
	}
	Output: InferIntersectionOutput<Branches>
}>

type InferIntersectionAsync<Branches extends ValSchema[], T extends boolean = false> = Equal<T, true> extends true
	? true
	: Branches extends [infer Schema extends ValSchema, ...infer Rest extends ValSchema[]]
		? InferIntersectionAsync<Rest, InferAsync<Schema>>
		: T

type InferIntersectionOutput<Branches extends ValSchema[], T = never> = Branches extends [infer B extends ValSchema, ...infer Rest extends ValSchema[]]
	? InferIntersectionOutput<Rest, T & InferOutput<B>>
	: T

export class IntersectionSchema<Branches extends ValSchema[]> extends AbstractSchema<IntersectionSchemaTypes<Branches>> {}

implementSchemaClass(
	IntersectionSchema,
	{
		isTransformed: ({ branches }) => branches.length > 0 && branches.some(branch => branch.isTransformed),
		validate: (value, { meta, success, failure, createExecutionChain }) => {
			const issues: ValidationIssue[] = []
			let isValid = true
			let chain = createExecutionChain()
			for (const branch of meta.branches) {
				chain = chain.then(() => {
					if (!isValid)
						return

					return createExecutionChain()
						.then(() => branch.validate(value))
						.then((result) => {
							if (!isSuccessResult(result)) {
								isValid = false
								issues.push(...result.issues)
							}
						})
				})
			}
			// @ts-expect-error Too complex for TS to infer the output type correctly
			return chain.then(() => (isValid ? success(value) : failure(issues)))
		},
	},
)

/**
 * Creates a intersection schema.
 */
export function intersection<Branches extends [ValSchema, ValSchema, ...ValSchema[]]>(branches: [...Branches]): IntersectionSchema<Branches> {
	return new IntersectionSchema({ meta: { branches } })
}
