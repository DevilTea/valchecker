import type { InferAsync, InferInput, InferIssueCode, InferMeta, InferOutput, InferResult, ValidationResult, ValSchema } from '../../src'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { any, isSuccessResult } from '../../src'

describe('any schema', () => {
	it('should validate any value', () => {
		const schema = any()
		expect(isSuccessResult(schema.validate(null))).toBe(true)
		expect(isSuccessResult(schema.validate(undefined))).toBe(true)
		expect(isSuccessResult(schema.validate(0))).toBe(true)
		expect(isSuccessResult(schema.validate('any'))).toBe(true)
		expect(isSuccessResult(schema.validate({}))).toBe(true)
		expect(isSuccessResult(schema.validate([]))).toBe(true)
		expect(isSuccessResult(schema.validate(Symbol('any')))).toBe(true)
	})

	it('should return the same value on successful validation', () => {
		const schema = any()
		const myObj = {}
		const result = schema.validate(myObj)
		if (isSuccessResult(result)) {
			expect(result.value).toBe(myObj)
		}
	})

	// Type Level Tests
	it('should infer types correctly', () => {
		const _s = any()
		type S = typeof _s
		expectTypeOf<S>().toExtend<ValSchema>()
		expectTypeOf<InferAsync<S>>().toEqualTypeOf<false>()
		expectTypeOf<InferMeta<S>>().toEqualTypeOf<null>()
		expectTypeOf<InferInput<S>>().toEqualTypeOf<unknown>()
		expectTypeOf<InferOutput<S>>().toEqualTypeOf<any>()
		expectTypeOf<InferIssueCode<S>>().toEqualTypeOf<'UNKNOWN_ERROR'>()
		expectTypeOf<InferResult<S>>().toEqualTypeOf<ValidationResult<any>>()
	})
})
