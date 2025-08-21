import type { BooleanSchema, InferAsync, InferInput, InferIssueCode, InferMeta, InferOutput, InferResult, NumberSchema, StringSchema, ValidationResult, ValSchema } from '../../src'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { boolean, isSuccessResult, number, string, union } from '../../src'

describe('union schema', () => {
	it('should validate values from any of the branches', () => {
		const schema = union([string(), number()])
		expect(isSuccessResult(schema.validate('hello'))).toBe(true)
		expect(isSuccessResult(schema.validate(123))).toBe(true)
	})

	it('should fail for values not in any of the branches', () => {
		const schema = union([string(), number()])
		expect(isSuccessResult(schema.validate(true))).toBe(false)
		expect(isSuccessResult(schema.validate({}))).toBe(false)
	})

	it('should collect issues from all branches on failure', () => {
		const schema = union([string(), number()])
		const result = schema.validate(true)
		expect(isSuccessResult(result)).toBe(false)
		if (!isSuccessResult(result)) {
			expect(result.issues.length).toBe(2)
			expect(result.issues.some(issue => issue.code === 'EXPECTED_STRING')).toBe(true)
			expect(result.issues.some(issue => issue.code === 'EXPECTED_NUMBER')).toBe(true)
		}
	})

	it('should return the correct value on successful validation', () => {
		const schema = union([string(), number()])
		const result = schema.validate('test')
		if (isSuccessResult(result)) {
			expect(result.value).toBe('test')
		}
	})

	it('should handle union with more than two schemas', () => {
		const schema = union([string(), number(), boolean()])
		expect(isSuccessResult(schema.validate('hello'))).toBe(true)
		expect(isSuccessResult(schema.validate(123))).toBe(true)
		expect(isSuccessResult(schema.validate(true))).toBe(true)
		expect(isSuccessResult(schema.validate({}))).toBe(false)
	})

	// Type Level Tests
	it('should infer types correctly', () => {
		const _s = union([string(), number(), boolean()])
		type S = typeof _s
		expectTypeOf<S>().toExtend<ValSchema>()
		expectTypeOf<InferAsync<S>>().toEqualTypeOf<false>()
		expectTypeOf<InferMeta<S>>().toEqualTypeOf<{ branches: [StringSchema, NumberSchema, BooleanSchema] }>()
		expectTypeOf<InferInput<S>>().toEqualTypeOf<unknown>()
		expectTypeOf<InferOutput<S>>().toEqualTypeOf<string | number | boolean>()
		expectTypeOf<InferIssueCode<S>>().toEqualTypeOf<'UNKNOWN_ERROR'>()
		expectTypeOf<InferResult<S>>().toEqualTypeOf<ValidationResult<string | number | boolean>>()
	})
})
