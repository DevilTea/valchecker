import type { DefineSchemaTypes, InferAsync, InferOutput, ValidationIssue, ValSchema } from '../core'
import type { Equal } from '../utils'
import { AbstractSchema, implementSchemaClass, isSuccessResult } from '../core'

type UnionSchemaTypes<Branches extends ValSchema[]> = DefineSchemaTypes<{
	Async: InferUnionAsync<Branches>
	Meta: {
		branches: Branches
	}
	Output: InferUnionOutput<Branches>
}>

type InferUnionAsync<Branches extends ValSchema[], T extends boolean = false> = Equal<T, true> extends true
	? true
	: Branches extends [infer Schema extends ValSchema, ...infer Rest extends ValSchema[]]
		? InferUnionAsync<Rest, InferAsync<Schema>>
		: T

type InferUnionOutput<Branches extends ValSchema[], T = never> = Branches extends [infer B extends ValSchema, ...infer Rest extends ValSchema[]]
	? InferUnionOutput<Rest, T | InferOutput<B>>
	: T

export class UnionSchema<Branches extends ValSchema[]> extends AbstractSchema<UnionSchemaTypes<Branches>> {}

implementSchemaClass(
	UnionSchema,
	{
		validate: (value, { meta, success, failure, createExecutionChain }) => {
			const issues: ValidationIssue[] = []
			let isValid = false
			let chain = createExecutionChain()
			for (const branch of meta.branches) {
				chain = chain.then(() => {
					if (isValid)
						return

					return createExecutionChain()
						.then(() => branch.validate(value))
						.then((result) => {
							if (isSuccessResult(result)) {
								isValid = true
								return
							}
							issues.push(...result.issues)
						})
				})
			}
			// @ts-expect-error Too complex for TS to infer the output type correctly
			return chain.then(() => (isValid ? success(value) : failure(issues)))
		},
	},
)

/**
 * Creates a union schema.
 */
export function union<Branches extends AbstractSchema[]>(branches: [...Branches]): UnionSchema<Branches> {
	return new UnionSchema({ meta: { branches } })
}
