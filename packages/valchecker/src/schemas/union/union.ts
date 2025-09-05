import type { DefineSchemaTypes, InferAsync, InferOutput, InferTransformed, ValidationIssue, ValidationResult, ValidationSuccessResult, ValSchema } from '../../core'
import type { Equal } from '../../shared'
import { AbstractSchema, implementSchemaClass, isSuccessResult } from '../../core'
import { createExecutionChain } from '../../shared'

type UnionSchemaTypes<Branches extends ValSchema[]> = DefineSchemaTypes<{
	Async: InferUnionAsync<Branches>
	Transformed: InferUnionTransformed<Branches>
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

type InferUnionTransformed<Branches extends ValSchema[], T extends boolean = false> = Equal<T, true> extends true
	? true
	: Branches extends [infer Schema extends ValSchema, ...infer Rest extends ValSchema[]]
		? InferUnionTransformed<Rest, InferTransformed<Schema>>
		: T

type InferUnionOutput<Branches extends ValSchema[], T = never> = Branches extends [infer B extends ValSchema, ...infer Rest extends ValSchema[]]
	? InferUnionOutput<Rest, T | InferOutput<B>>
	: Equal<T, never> extends true
		? unknown
		: T

class UnionSchema<Branches extends ValSchema[]> extends AbstractSchema<UnionSchemaTypes<Branches>> {}

implementSchemaClass(
	UnionSchema,
	{
		isTransformed: ({ branches }) => branches.length > 0 && branches.some(branch => branch.isTransformed),
		validate: (value, { meta, failure }) => {
			const issues: ValidationIssue[] = []
			let isValid: ValidationSuccessResult<any> | null = null
			if (meta.branches.length === 0) {
				return failure('NO_BRANCHES_PROVIDED')
			}

			let chain = createExecutionChain()
			for (const branch of meta.branches) {
				chain = chain.then(() => {
					if (isValid)
						return

					return createExecutionChain()
						.then(() => branch.validate(value))
						.then((result) => {
							if (isSuccessResult(result)) {
								isValid = result
								return
							}
							issues.push(...result.issues)
						})
				})
			}
			return chain.then<ValidationResult<any>>(() => (isValid || failure(issues)))
		},
	},
)

/**
 * Creates a union schema.
 */
function union<Branches extends [ValSchema, ValSchema, ...ValSchema[]]>(...branches: [...Branches]): UnionSchema<Branches> {
	return new UnionSchema({ meta: { branches } })
}

export {
	union,
	UnionSchema,
}
