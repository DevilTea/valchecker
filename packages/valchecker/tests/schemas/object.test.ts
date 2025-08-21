import type { InferAsync, InferInput, InferIssueCode, InferMeta, InferOutput, InferResult, NumberSchema, StringSchema, ValidationResult, ValSchema } from '../../src'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { isSuccessResult, number, object, string } from '../../src'

describe('object schema', () => {
	it('should validate an object with correct properties', () => {
		const schema = object({
			name: string(),
			age: number(),
		})
		const result = schema.validate({ name: 'John', age: 30 })
		expect(isSuccessResult(result)).toBe(true)
		if (isSuccessResult(result)) {
			expect(result.value).toEqual({ name: 'John', age: 30 })
		}
	})

	it('should fail for non-object values', () => {
		const schema = object({})
		expect(isSuccessResult(schema.validate(123))).toBe(false)
		expect(isSuccessResult(schema.validate(null))).toBe(false)
		expect(isSuccessResult(schema.validate(undefined))).toBe(false)
		expect(isSuccessResult(schema.validate('string'))).toBe(false)
		expect(isSuccessResult(schema.validate([]))).toBe(false)
	})

	it('should fail if a property has an incorrect type', () => {
		const schema = object({
			name: string(),
			age: number(),
		})
		const result = schema.validate({ name: 'John', age: '30' })
		expect(isSuccessResult(result)).toBe(false)
		if (!isSuccessResult(result)) {
			expect(result.issues[0]?.path).toEqual(['age'])
			expect(result.issues[0]?.code).toBe('EXPECTED_NUMBER')
		}
	})

	it('should handle nested objects', () => {
		const schema = object({
			user: object({
				name: string(),
			}),
		})
		const result = schema.validate({ user: { name: 'John' } })
		expect(isSuccessResult(result)).toBe(true)
		if (isSuccessResult(result)) {
			expect(result.value).toEqual({ user: { name: 'John' } })
		}
	})

	it('should report issues in nested objects with correct path', () => {
		const schema = object({
			user: object({
				name: string(),
			}),
		})
		const result = schema.validate({ user: { name: 123 } })
		expect(isSuccessResult(result)).toBe(false)
		if (!isSuccessResult(result)) {
			expect(result.issues[0]?.path).toEqual(['user', 'name'])
			expect(result.issues[0]?.code).toBe('EXPECTED_STRING')
		}
	})

	it('should use custom message for expected object error', () => {
		const schema = object({}, { EXPECTED_OBJECT: 'This must be an object' })
		const result = schema.validate(123)
		expect(isSuccessResult(result)).toBe(false)
		if (!isSuccessResult(result)) {
			expect(result.issues[0]?.message).toBe('This must be an object')
		}
	})

	// Type Level Tests
	it('should infer types correctly', () => {
		const _s = object({
			name: string(),
			age: number(),
		})
		type S = typeof _s
		expectTypeOf<S>().toExtend<ValSchema>()
		expectTypeOf<InferAsync<S>>().toEqualTypeOf<false>()
		expectTypeOf<InferMeta<S>>().toEqualTypeOf<{ struct: { name: StringSchema, age: NumberSchema } }>()
		expectTypeOf<InferInput<S>>().toEqualTypeOf<unknown>()
		expectTypeOf<InferOutput<S>>().toEqualTypeOf<{ name: string, age: number }>()
		expectTypeOf<InferIssueCode<S>>().toEqualTypeOf<'UNKNOWN_ERROR' | 'EXPECTED_OBJECT'>()
		expectTypeOf<InferResult<S>>().toEqualTypeOf<ValidationResult<{ name: string, age: number }>>()
	})
})
