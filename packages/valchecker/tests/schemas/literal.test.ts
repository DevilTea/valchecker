import type { InferAsync, InferInput, InferIssueCode, InferMeta, InferOutput, InferResult, ValidationResult, ValSchema } from '../../src'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { isSuccessResult, literal } from '../../src'

describe('literal schema', () => {
	it('should validate literals', () => {
		const s1 = literal('hello')
		expect(isSuccessResult(s1.validate('hello'))).toBe(true)
		const s2 = literal(123)
		expect(isSuccessResult(s2.validate(123))).toBe(true)
		const s3 = literal(Number.NaN)
		expect(isSuccessResult(s3.validate(Number.NaN))).toBe(true)
		const s4 = literal(true)
		expect(isSuccessResult(s4.validate(true))).toBe(true)
		const s5 = literal(123n)
		expect(isSuccessResult(s5.validate(123n))).toBe(true)
		const symbol = Symbol('test')
		const s6 = literal(symbol)
		expect(isSuccessResult(s6.validate(symbol))).toBe(true)
	})

	it('should fail for invalid values', () => {
		const s1 = literal('hello')
		expect(isSuccessResult(s1.validate(null))).toBe(false)
		const s2 = literal(123)
		expect(isSuccessResult(s2.validate(null))).toBe(false)
		const s3 = literal(Number.NaN)
		expect(isSuccessResult(s3.validate(null))).toBe(false)
		const s4 = literal(true)
		expect(isSuccessResult(s4.validate(null))).toBe(false)
		const s5 = literal(123n)
		expect(isSuccessResult(s5.validate(null))).toBe(false)
		const symbol = Symbol('test')
		const s6 = literal(symbol)
		expect(isSuccessResult(s6.validate(null))).toBe(false)
	})

	it('should use custom message for expected string error', () => {
		const schema = literal('hello', { INVALID_LITERAL: 'Custom message' })
		const result = schema.validate(123)
		expect(isSuccessResult(result)).toBe(false)
		if (!isSuccessResult(result)) {
			expect(result.issues[0]?.message).toBe('Custom message')
		}
	})

	it('should return the correct value on successful validation', () => {
		const schema = literal('test')
		const result = schema.validate('test')
		if (isSuccessResult(result)) {
			expect(result.value).toBe('test')
		}
	})

	it('should handle issue codes correctly', () => {
		const schema = literal('test')
		const result = schema.validate(123)
		expect(isSuccessResult(result)).toBe(false)
		if (!isSuccessResult(result)) {
			expect(result.issues[0]?.code).toBe('INVALID_LITERAL')
		}
	})

	// Type Level Tests
	it('should infer types correctly', () => {
		const _s1 = literal('test')
		type S1 = typeof _s1
		expectTypeOf<S1>().toExtend<ValSchema>()
		expectTypeOf<InferAsync<S1>>().toEqualTypeOf<false>()
		expectTypeOf<InferMeta<S1>>().toEqualTypeOf<{ value: 'test' }>()
		expectTypeOf<InferInput<S1>>().toEqualTypeOf<unknown>()
		expectTypeOf<InferOutput<S1>>().toEqualTypeOf<'test'>()
		expectTypeOf<InferIssueCode<S1>>().toEqualTypeOf<'UNKNOWN_ERROR' | 'INVALID_LITERAL'>()
		expectTypeOf<InferResult<S1>>().toEqualTypeOf<ValidationResult<'test'>>()

		const _s2 = literal(123)
		type S2 = typeof _s2
		expectTypeOf<S2>().toExtend<ValSchema>()
		expectTypeOf<InferAsync<S2>>().toEqualTypeOf<false>()
		expectTypeOf<InferMeta<S2>>().toEqualTypeOf<{ value: 123 }>()
		expectTypeOf<InferInput<S2>>().toEqualTypeOf<unknown>()
		expectTypeOf<InferOutput<S2>>().toEqualTypeOf<123>()
		expectTypeOf<InferIssueCode<S2>>().toEqualTypeOf<'UNKNOWN_ERROR' | 'INVALID_LITERAL'>()
		expectTypeOf<InferResult<S2>>().toEqualTypeOf<ValidationResult<123>>()

		const _s3 = literal(true)
		type S3 = typeof _s3
		expectTypeOf<S3>().toExtend<ValSchema>()
		expectTypeOf<InferAsync<S3>>().toEqualTypeOf<false>()
		expectTypeOf<InferMeta<S3>>().toEqualTypeOf<{ value: true }>()
		expectTypeOf<InferInput<S3>>().toEqualTypeOf<unknown>()
		expectTypeOf<InferOutput<S3>>().toEqualTypeOf<true>()
		expectTypeOf<InferIssueCode<S3>>().toEqualTypeOf<'UNKNOWN_ERROR' | 'INVALID_LITERAL'>()
		expectTypeOf<InferResult<S3>>().toEqualTypeOf<ValidationResult<true>>()

		const _s4 = literal(123n)
		type S4 = typeof _s4
		expectTypeOf<S4>().toExtend<ValSchema>()
		expectTypeOf<InferAsync<S4>>().toEqualTypeOf<false>()
		expectTypeOf<InferMeta<S4>>().toEqualTypeOf<{ value: 123n }>()
		expectTypeOf<InferInput<S4>>().toEqualTypeOf<unknown>()
		expectTypeOf<InferOutput<S4>>().toEqualTypeOf<123n>()
		expectTypeOf<InferIssueCode<S4>>().toEqualTypeOf<'UNKNOWN_ERROR' | 'INVALID_LITERAL'>()
		expectTypeOf<InferResult<S4>>().toEqualTypeOf<ValidationResult<123n>>()

		const symbol = Symbol('test')
		const _s5 = literal(symbol)
		type S5 = typeof _s5
		expectTypeOf<S5>().toExtend<ValSchema>()
		expectTypeOf<InferAsync<S5>>().toEqualTypeOf<false>()
		expectTypeOf<InferMeta<S5>>().toEqualTypeOf<{ value: typeof symbol }>()
		expectTypeOf<InferInput<S5>>().toEqualTypeOf<unknown>()
		expectTypeOf<InferOutput<S5>>().toEqualTypeOf<typeof symbol>()
		expectTypeOf<InferIssueCode<S5>>().toEqualTypeOf<'UNKNOWN_ERROR' | 'INVALID_LITERAL'>()
		expectTypeOf<InferResult<S5>>().toEqualTypeOf<ValidationResult<typeof symbol>>()
	})
})
