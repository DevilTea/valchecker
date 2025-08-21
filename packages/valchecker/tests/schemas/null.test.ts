import type { InferAsync, InferInput, InferIssueCode, InferMeta, InferOutput, InferResult, ValidationResult, ValSchema } from '../../src'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { isSuccessResult, null_ } from '../../src'

describe('null schema', () => {
	it('should validate null', () => {
		const schema = null_()
		expect(isSuccessResult(schema.validate(null))).toBe(true)
	})

	it('should fail for non-null values', () => {
		const schema = null_()
		expect(isSuccessResult(schema.validate(undefined))).toBe(false)
		expect(isSuccessResult(schema.validate(0))).toBe(false)
		expect(isSuccessResult(schema.validate('null'))).toBe(false)
		expect(isSuccessResult(schema.validate({}))).toBe(false)
		expect(isSuccessResult(schema.validate([]))).toBe(false)
	})

	it('should use custom message for expected null error', () => {
		const schema = null_({ EXPECTED_NULL: 'Custom message' })
		const result = schema.validate(undefined)
		expect(isSuccessResult(result)).toBe(false)
		if (!isSuccessResult(result)) {
			expect(result.issues[0]?.message).toBe('Custom message')
		}
	})

	it('should return null on successful validation', () => {
		const schema = null_()
		const result = schema.validate(null)
		if (isSuccessResult(result)) {
			expect(result.value).toBe(null)
		}
	})

	// Type Level Tests
	it('should infer types correctly', () => {
		const _s = null_()
		type S = typeof _s
		expectTypeOf<S>().toExtend<ValSchema>()
		expectTypeOf<InferAsync<S>>().toEqualTypeOf<false>()
		expectTypeOf<InferMeta<S>>().toEqualTypeOf<null>()
		expectTypeOf<InferInput<S>>().toEqualTypeOf<unknown>()
		expectTypeOf<InferOutput<S>>().toEqualTypeOf<null>()
		expectTypeOf<InferIssueCode<S>>().toEqualTypeOf<'UNKNOWN_ERROR' | 'EXPECTED_NULL'>()
		expectTypeOf<InferResult<S>>().toEqualTypeOf<ValidationResult<null>>()
	})
})
