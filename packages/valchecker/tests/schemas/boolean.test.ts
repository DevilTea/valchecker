import type { InferAsync, InferInput, InferIssueCode, InferMeta, InferOutput, InferResult, ValidationResult, ValSchema } from '../../src'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { boolean, isSuccessResult } from '../../src'

describe('boolean schema', () => {
	it('should validate true and false', () => {
		const schema = boolean()
		expect(isSuccessResult(schema.validate(true))).toBe(true)
		expect(isSuccessResult(schema.validate(false))).toBe(true)
	})

	it('should fail for non-boolean values', () => {
		const schema = boolean()
		expect(isSuccessResult(schema.validate('true'))).toBe(false)
		expect(isSuccessResult(schema.validate(1))).toBe(false)
		expect(isSuccessResult(schema.validate(null))).toBe(false)
		expect(isSuccessResult(schema.validate(undefined))).toBe(false)
		expect(isSuccessResult(schema.validate({}))).toBe(false)
		expect(isSuccessResult(schema.validate([]))).toBe(false)
	})

	it('should use custom message for expected boolean error', () => {
		const schema = boolean({ EXPECTED_BOOLEAN: 'Custom message' })
		const result = schema.validate('not a boolean')
		expect(isSuccessResult(result)).toBe(false)
		if (!isSuccessResult(result)) {
			expect(result.issues[0]?.message).toBe('Custom message')
		}
	})

	it('should return the correct value on successful validation', () => {
		const schema = boolean()
		const result = schema.validate(true)
		if (isSuccessResult(result)) {
			expect(result.value).toBe(true)
		}
	})

	// Type Level Tests
	it('should infer types correctly', () => {
		const _s = boolean()
		type S = typeof _s
		expectTypeOf<S>().toExtend<ValSchema>()
		expectTypeOf<InferAsync<S>>().toEqualTypeOf<false>()
		expectTypeOf<InferMeta<S>>().toEqualTypeOf<null>()
		expectTypeOf<InferInput<S>>().toEqualTypeOf<unknown>()
		expectTypeOf<InferOutput<S>>().toEqualTypeOf<boolean>()
		expectTypeOf<InferIssueCode<S>>().toEqualTypeOf<'UNKNOWN_ERROR' | 'EXPECTED_BOOLEAN'>()
		expectTypeOf<InferResult<S>>().toEqualTypeOf<ValidationResult<boolean>>()
	})
})
