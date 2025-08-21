import type { BooleanSchema, InferAsync, InferInput, InferIssueCode, InferMeta, InferOutput, InferResult, NumberSchema, StringSchema, ValidationResult, ValSchema } from '../../src'
import { describe, expectTypeOf, it } from 'vitest'
import { boolean, intersection, number, string } from '../../src'

describe('intersection schema', () => {
	// TODO: Add more tests

	// Type Level Tests
	it('should infer types correctly', () => {
		const _s1 = intersection([string(), number(), boolean()])
		type S1 = typeof _s1
		expectTypeOf<S1>().toExtend<ValSchema>()
		expectTypeOf<InferAsync<S1>>().toEqualTypeOf<false>()
		expectTypeOf<InferMeta<S1>>().toEqualTypeOf<{ branches: [StringSchema, NumberSchema, BooleanSchema] }>()
		expectTypeOf<InferInput<S1>>().toEqualTypeOf<unknown>()
		expectTypeOf<InferOutput<S1>>().toEqualTypeOf<never>()
		expectTypeOf<InferIssueCode<S1>>().toEqualTypeOf<'UNKNOWN_ERROR'>()
		expectTypeOf<InferResult<S1>>().toEqualTypeOf<ValidationResult<never>>()
	})
})
