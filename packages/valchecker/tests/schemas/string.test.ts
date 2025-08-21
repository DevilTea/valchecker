import type { InferAsync, InferInput, InferIssueCode, InferMeta, InferOutput, InferResult, ValidationResult, ValSchema } from '../../src'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { isSuccessResult, string } from '../../src'

describe('string schema', () => {
	it('should validate any string', () => {
		const schema = string()
		expect(isSuccessResult(schema.validate('hello'))).toBe(true)
		expect(isSuccessResult(schema.validate(''))).toBe(true)
	})

	it('should fail for non-string values', () => {
		const schema = string()
		expect(isSuccessResult(schema.validate(123))).toBe(false)
		expect(isSuccessResult(schema.validate(null))).toBe(false)
		expect(isSuccessResult(schema.validate(undefined))).toBe(false)
		expect(isSuccessResult(schema.validate({}))).toBe(false)
		expect(isSuccessResult(schema.validate([]))).toBe(false)
	})

	it('should use custom message for expected string error', () => {
		const schema = string({ EXPECTED_STRING: 'Custom message' })
		const result = schema.validate(123)
		expect(isSuccessResult(result)).toBe(false)
		if (!isSuccessResult(result)) {
			expect(result.issues[0]?.message).toBe('Custom message')
		}
	})

	it('should return the correct value on successful validation', () => {
		const schema = string()
		const result = schema.validate('test')
		if (isSuccessResult(result)) {
			expect(result.value).toBe('test')
		}
	})

	it('should handle issue codes correctly', () => {
		const schema = string()
		const result = schema.validate(123)
		expect(isSuccessResult(result)).toBe(false)
		if (!isSuccessResult(result)) {
			expect(result.issues[0]?.code).toBe('EXPECTED_STRING')
		}
	})

	// Type Level Tests
	it('should infer types correctly', () => {
		const _s = string()
		type S = typeof _s
		expectTypeOf<S>().toExtend<ValSchema>()
		expectTypeOf<InferAsync<S>>().toEqualTypeOf<false>()
		expectTypeOf<InferMeta<S>>().toEqualTypeOf<null>()
		expectTypeOf<InferInput<S>>().toEqualTypeOf<unknown>()
		expectTypeOf<InferOutput<S>>().toEqualTypeOf<string>()
		expectTypeOf<InferIssueCode<S>>().toEqualTypeOf<'UNKNOWN_ERROR' | 'EXPECTED_STRING'>()
		expectTypeOf<InferResult<S>>().toEqualTypeOf<ValidationResult<string>>()
	})
})
