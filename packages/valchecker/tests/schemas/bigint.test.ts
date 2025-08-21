import type { InferAsync, InferInput, InferIssueCode, InferMeta, InferOutput, InferResult, ValidationResult, ValSchema } from '../../src'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { bigint, isSuccessResult } from '../../src'

describe('bigint schema', () => {
	it('should validate any bigint', () => {
		const schema = bigint()
		expect(isSuccessResult(schema.validate(BigInt(9007199254740991)))).toBe(true)
		expect(isSuccessResult(schema.validate(0n))).toBe(true)
	})

	it('should fail for non-bigint values', () => {
		const schema = bigint()
		expect(isSuccessResult(schema.validate(123))).toBe(false)
		expect(isSuccessResult(schema.validate('9007199254740991'))).toBe(false)
		expect(isSuccessResult(schema.validate(null))).toBe(false)
		expect(isSuccessResult(schema.validate(undefined))).toBe(false)
		expect(isSuccessResult(schema.validate({}))).toBe(false)
		expect(isSuccessResult(schema.validate([]))).toBe(false)
	})

	it('should use custom message for expected bigint error', () => {
		const schema = bigint({ EXPECTED_BIGINT: 'Custom message' })
		const result = schema.validate('not a bigint')
		expect(isSuccessResult(result)).toBe(false)
		if (!isSuccessResult(result)) {
			expect(result.issues[0]?.message).toBe('Custom message')
		}
	})

	it('should return the correct value on successful validation', () => {
		const schema = bigint()
		const result = schema.validate(123n)
		if (isSuccessResult(result)) {
			expect(result.value).toBe(123n)
		}
	})

	// Type Level Tests
	it('should infer types correctly', () => {
		const _s = bigint()
		type S = typeof _s
		expectTypeOf<S>().toExtend<ValSchema>()
		expectTypeOf<InferAsync<S>>().toEqualTypeOf<false>()
		expectTypeOf<InferMeta<S>>().toEqualTypeOf<null>()
		expectTypeOf<InferInput<S>>().toEqualTypeOf<unknown>()
		expectTypeOf<InferOutput<S>>().toEqualTypeOf<bigint>()
		expectTypeOf<InferIssueCode<S>>().toEqualTypeOf<'UNKNOWN_ERROR' | 'EXPECTED_BIGINT'>()
		expectTypeOf<InferResult<S>>().toEqualTypeOf<ValidationResult<bigint>>()
	})
})
