import type { InferAsync, InferInput, InferIssueCode, InferMeta, InferOutput, InferResult, ValidationResult, ValSchema } from '../../src'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { isSuccessResult, undefined_ } from '../../src'

describe('undefined schema', () => {
	it('should validate undefined', () => {
		const schema = undefined_()
		expect(isSuccessResult(schema.validate(undefined))).toBe(true)
	})

	it('should fail for non-undefined values', () => {
		const schema = undefined_()
		expect(isSuccessResult(schema.validate(null))).toBe(false)
		expect(isSuccessResult(schema.validate(0))).toBe(false)
		expect(isSuccessResult(schema.validate('undefined'))).toBe(false)
		expect(isSuccessResult(schema.validate({}))).toBe(false)
		expect(isSuccessResult(schema.validate([]))).toBe(false)
	})

	it('should use custom message for expected undefined error', () => {
		const schema = undefined_({ EXPECTED_UNDEFINED: 'Custom message' })
		const result = schema.validate(null)
		expect(isSuccessResult(result)).toBe(false)
		if (!isSuccessResult(result)) {
			expect(result.issues[0]?.message).toBe('Custom message')
		}
	})

	it('should return undefined on successful validation', () => {
		const schema = undefined_()
		const result = schema.validate(undefined)
		if (isSuccessResult(result)) {
			expect(result.value).toBe(undefined)
		}
	})

	// Type Level Tests
	it('should infer types correctly', () => {
		const _s = undefined_()
		type S = typeof _s
		expectTypeOf<S>().toExtend<ValSchema>()
		expectTypeOf<InferAsync<S>>().toEqualTypeOf<false>()
		expectTypeOf<InferMeta<S>>().toEqualTypeOf<null>()
		expectTypeOf<InferInput<S>>().toEqualTypeOf<unknown>()
		expectTypeOf<InferOutput<S>>().toEqualTypeOf<undefined>()
		expectTypeOf<InferIssueCode<S>>().toEqualTypeOf<'UNKNOWN_ERROR' | 'EXPECTED_UNDEFINED'>()
		expectTypeOf<InferResult<S>>().toEqualTypeOf<ValidationResult<undefined>>()
	})
})
