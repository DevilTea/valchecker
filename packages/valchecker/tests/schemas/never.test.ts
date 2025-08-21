import type { InferAsync, InferInput, InferIssueCode, InferMeta, InferOutput, InferResult, ValidationResult, ValSchema } from '../../src'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { isSuccessResult, never } from '../../src'

describe('never schema', () => {
	it('should fail for any value', () => {
		const schema = never()
		expect(isSuccessResult(schema.validate(null))).toBe(false)
		expect(isSuccessResult(schema.validate(undefined))).toBe(false)
		expect(isSuccessResult(schema.validate(0))).toBe(false)
		expect(isSuccessResult(schema.validate('never'))).toBe(false)
		expect(isSuccessResult(schema.validate({}))).toBe(false)
		expect(isSuccessResult(schema.validate([]))).toBe(false)
		expect(isSuccessResult(schema.validate(Symbol('never')))).toBe(false)
	})

	it('should use custom message for expected never error', () => {
		const schema = never({ EXPECTED_NEVER: 'Custom message' })
		const result = schema.validate('any value')
		expect(isSuccessResult(result)).toBe(false)
		if (!isSuccessResult(result)) {
			expect(result.issues[0]?.message).toBe('Custom message')
		}
	})

	// Type Level Tests
	it('should infer types correctly', () => {
		const _s = never()
		type S = typeof _s
		expectTypeOf<S>().toExtend<ValSchema>()
		expectTypeOf<InferAsync<S>>().toEqualTypeOf<false>()
		expectTypeOf<InferMeta<S>>().toEqualTypeOf<null>()
		expectTypeOf<InferInput<S>>().toEqualTypeOf<unknown>()
		expectTypeOf<InferOutput<S>>().toEqualTypeOf<never>()
		expectTypeOf<InferIssueCode<S>>().toEqualTypeOf<'UNKNOWN_ERROR' | 'EXPECTED_NEVER'>()
		expectTypeOf<InferResult<S>>().toEqualTypeOf<ValidationResult<never>>()
	})
})
