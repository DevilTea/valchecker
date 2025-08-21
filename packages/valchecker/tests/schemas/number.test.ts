import type { InferAsync, InferInput, InferIssueCode, InferMeta, InferOutput, InferResult, ValidationResult, ValSchema } from '../../src'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { isSuccessResult, number } from '../../src'

describe('number schema', () => {
	it('should validate any number but not NaN by default', () => {
		const schema = number()
		expect(isSuccessResult(schema.validate(123))).toBe(true)
		expect(isSuccessResult(schema.validate(0))).toBe(true)
		expect(isSuccessResult(schema.validate(-123))).toBe(true)
		expect(isSuccessResult(schema.validate(1.23))).toBe(true)
		expect(isSuccessResult(schema.validate(Number.NaN))).toBe(false)
	})

	it('should allow NaN when specified', () => {
		const schema = number(true)
		expect(isSuccessResult(schema.validate(Number.NaN))).toBe(true)
	})

	it('should fail for non-number values', () => {
		const schema = number()
		expect(isSuccessResult(schema.validate('123'))).toBe(false)
		expect(isSuccessResult(schema.validate(null))).toBe(false)
		expect(isSuccessResult(schema.validate(undefined))).toBe(false)
		expect(isSuccessResult(schema.validate({}))).toBe(false)
		expect(isSuccessResult(schema.validate([]))).toBe(false)
	})

	it('should use custom message for expected number error', () => {
		const schema = number({ EXPECTED_NUMBER: 'Custom message' })
		const result = schema.validate('not a number')
		expect(isSuccessResult(result)).toBe(false)
		if (!isSuccessResult(result)) {
			expect(result.issues[0]?.message).toBe('Custom message')
		}
	})

	it('should return the correct value on successful validation', () => {
		const schema = number()
		const result = schema.validate(123)
		if (isSuccessResult(result)) {
			expect(result.value).toBe(123)
		}
	})

	// Type Level Tests
	it('should infer types correctly', () => {
		const _s1 = number()
		type S1 = typeof _s1
		expectTypeOf<S1>().toExtend<ValSchema>()
		expectTypeOf<InferAsync<S1>>().toEqualTypeOf<false>()
		expectTypeOf<InferMeta<S1>>().toEqualTypeOf<{ allowNaN: boolean }>()
		expectTypeOf<InferInput<S1>>().toEqualTypeOf<unknown>()
		expectTypeOf<InferOutput<S1>>().toEqualTypeOf<number>()
		expectTypeOf<InferIssueCode<S1>>().toEqualTypeOf<'UNKNOWN_ERROR' | 'EXPECTED_NUMBER'>()
		expectTypeOf<InferResult<S1>>().toEqualTypeOf<ValidationResult<number>>()

		const _s2 = number(true)
		type S2 = typeof _s2
		expectTypeOf<S2>().toExtend<ValSchema>()
		expectTypeOf<InferAsync<S2>>().toEqualTypeOf<false>()
		expectTypeOf<InferMeta<S2>>().toEqualTypeOf<{ allowNaN: boolean }>()
		expectTypeOf<InferInput<S2>>().toEqualTypeOf<unknown>()
		expectTypeOf<InferOutput<S2>>().toEqualTypeOf<number>()
		expectTypeOf<InferIssueCode<S2>>().toEqualTypeOf<'UNKNOWN_ERROR' | 'EXPECTED_NUMBER'>()
		expectTypeOf<InferResult<S2>>().toEqualTypeOf<ValidationResult<number>>()
	})
})
