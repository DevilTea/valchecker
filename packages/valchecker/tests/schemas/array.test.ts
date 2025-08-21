import type { ArraySchema, InferAsync, InferInput, InferIssueCode, InferMeta, InferOutput, InferResult, NumberSchema, StringSchema, ValidationResult, ValSchema } from '../../src'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { array, isSuccessResult, number, string } from '../../src'

describe('array schema', () => {
	it('should validate an array of a given type', () => {
		const schema = array(string())
		expect(isSuccessResult(schema.validate(['a', 'b', 'c']))).toBe(true)
		expect(isSuccessResult(schema.validate([]))).toBe(true)
	})

	it('should fail for non-array values', () => {
		const schema = array(string())
		expect(isSuccessResult(schema.validate(123))).toBe(false)
		expect(isSuccessResult(schema.validate(null))).toBe(false)
		expect(isSuccessResult(schema.validate(undefined))).toBe(false)
		expect(isSuccessResult(schema.validate({}))).toBe(false)
	})

	it('should fail if items are of the wrong type', async () => {
		const schema = array(number())
		const result = await schema.validate([1, '2', 3])
		expect(isSuccessResult(result)).toBe(false)
		if (!isSuccessResult(result)) {
			expect(result.issues).toHaveLength(1)
			expect(result.issues[0]?.path).toEqual([1])
			expect(result.issues[0]?.code).toBe('EXPECTED_NUMBER')
		}
	})

	it('should use custom message for expected array error', () => {
		const schema = array(string(), { EXPECTED_ARRAY: 'Custom message' })
		const result = schema.validate(123)
		expect(isSuccessResult(result)).toBe(false)
		if (!isSuccessResult(result)) {
			expect(result.issues[0]?.message).toBe('Custom message')
		}
	})

	it('should return the correct value on successful validation', () => {
		const schema = array(string())
		const result = schema.validate(['hello', 'world'])
		if (isSuccessResult(result)) {
			expect(result.value).toEqual(['hello', 'world'])
		}
	})

	it('should handle nested arrays', async () => {
		const schema = array(array(number()))
		expect(isSuccessResult(await schema.validate([[1], [2, 3]]))).toBe(true)

		const result = await schema.validate([[1], [2, 'a']])
		expect(isSuccessResult(result)).toBe(false)
		if (!isSuccessResult(result)) {
			expect(result.issues).toHaveLength(1)
			expect(result.issues[0]?.path).toEqual([1, 1])
			expect(result.issues[0]?.code).toBe('EXPECTED_NUMBER')
		}
	})

	it('should aggregate issues from all items', async () => {
		const schema = array(number())
		const result = await schema.validate(['1', '2', 3, '4'])
		expect(isSuccessResult(result)).toBe(false)
		if (!isSuccessResult(result)) {
			expect(result.issues).toHaveLength(3)
			expect(result.issues.map(i => i.path)).toEqual([[0], [1], [3]])
		}
	})

	// Type Level Tests
	it('should infer types correctly', () => {
		const _s1 = array(string())
		type S1 = typeof _s1
		expectTypeOf<S1>().toExtend<ValSchema>()
		expectTypeOf<InferAsync<S1>>().toEqualTypeOf<false>()
		expectTypeOf<InferMeta<S1>>().toEqualTypeOf<{ item: StringSchema }>()
		expectTypeOf<InferInput<S1>>().toEqualTypeOf<unknown>()
		expectTypeOf<InferOutput<S1>>().toEqualTypeOf<string[]>()
		expectTypeOf<InferIssueCode<S1>>().toEqualTypeOf<'UNKNOWN_ERROR' | 'EXPECTED_ARRAY'>()
		expectTypeOf<InferResult<S1>>().toEqualTypeOf<ValidationResult<string[]>>()

		const _s2 = array(array(number()))
		type S2 = typeof _s2
		expectTypeOf<S2>().toExtend<ValSchema>()
		expectTypeOf<InferAsync<S2>>().toEqualTypeOf<false>()
		expectTypeOf<InferMeta<S2>>().toEqualTypeOf<{ item: ArraySchema<NumberSchema> }>()
		expectTypeOf<InferInput<S2>>().toEqualTypeOf<unknown>()
		expectTypeOf<InferOutput<S2>>().toEqualTypeOf<number[][]>()
		expectTypeOf<InferIssueCode<S2>>().toEqualTypeOf<'UNKNOWN_ERROR' | 'EXPECTED_ARRAY'>()
		expectTypeOf<InferResult<S2>>().toEqualTypeOf<ValidationResult<number[][]>>()
	})
})
