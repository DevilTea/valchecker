import type { InferAsync, InferInput, InferIssueCode, InferMeta, InferOutput, InferResult, ValidationResult, ValSchema } from '../../src'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { isSuccessResult, unknown } from '../../src'

describe('unknown schema', () => {
	it('should validate any value', () => {
		const schema = unknown()
		expect(isSuccessResult(schema.validate(null))).toBe(true)
		expect(isSuccessResult(schema.validate(undefined))).toBe(true)
		expect(isSuccessResult(schema.validate(0))).toBe(true)
		expect(isSuccessResult(schema.validate('unknown'))).toBe(true)
		expect(isSuccessResult(schema.validate({}))).toBe(true)
		expect(isSuccessResult(schema.validate([]))).toBe(true)
		expect(isSuccessResult(schema.validate(Symbol('unknown')))).toBe(true)
	})

	it('should return the same value on successful validation', () => {
		const schema = unknown()
		const myObj = {}
		const result = schema.validate(myObj)
		if (isSuccessResult(result)) {
			expect(result.value).toBe(myObj)
		}
	})

	// Type Level Tests
	it('should infer types correctly', () => {
		const _s = unknown()
		type S = typeof _s
		expectTypeOf<S>().toExtend<ValSchema>()
		expectTypeOf<InferAsync<S>>().toEqualTypeOf<false>()
		expectTypeOf<InferMeta<S>>().toEqualTypeOf<null>()
		expectTypeOf<InferInput<S>>().toEqualTypeOf<unknown>()
		expectTypeOf<InferOutput<S>>().toEqualTypeOf<unknown>()
		expectTypeOf<InferIssueCode<S>>().toEqualTypeOf<'UNKNOWN_ERROR'>()
		expectTypeOf<InferResult<S>>().toEqualTypeOf<ValidationResult<unknown>>()
	})
})
