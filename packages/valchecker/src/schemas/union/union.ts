import type { DefineSchemaTypes, ExecutionIssue, ExecutionResult, InferAsync, InferOutput, InferTransformed, ValSchema } from '../../core'
import type { Equal } from '../../shared'
import { AbstractSchema, isSuccess } from '../../core'

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

class UnionSchema<Branches extends ValSchema[]> extends AbstractSchema<UnionSchemaTypes<Branches>> {
	setup() {
		this.implementSchemaClass(
			UnionSchema,
			{
				isTransformed: ({ branches }) => branches.length > 0 && branches.some(branch => branch.isTransformed),
				execute: (value, { meta, success, failure }) => {
					const issues: ExecutionIssue[] = []
					let isValid = false

					function processResult(result: ExecutionResult<any>) {
						if (isSuccess(result)) {
							isValid = true
							return
						}
						issues.push(...result.issues)
					}

					let promise: Promise<void> | null = null

					for (const branch of meta.branches) {
						const result = branch.execute(value)
						if (promise == null) {
							// Early return if already valid
							if (isValid)
								break

							if (result instanceof Promise)
								promise = result.then(processResult)
							else
								processResult(result)
						}
						else {
							promise = promise.then(() => isValid
								// Early return if already valid
								? void 0
								: Promise.resolve(result).then(processResult))
						}
					}
					return promise == null
						? (isValid ? success(value) : failure(issues))
						: promise.then(() => isValid ? success(value) : failure(issues))
				},
			},
		)
	}
}

/* @__NO_SIDE_EFFECTS__ */
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
