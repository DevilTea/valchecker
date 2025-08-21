import type { InferAsync, InferInput, InferIssueCode, InferMeta, InferOutput, InferResult, ValidationResult, ValSchema } from '../../src'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { instance, isSuccessResult } from '../../src'

class MyClass {}
class AnotherClass {}

describe('instance schema', () => {
	it('should validate instances of the constructor', () => {
		const schema = instance(MyClass)
		expect(isSuccessResult(schema.validate(new MyClass()))).toBe(true)
	})

	it('should fail for non-instances', () => {
		const schema = instance(MyClass)
		expect(isSuccessResult(schema.validate(new AnotherClass()))).toBe(false)
		expect(isSuccessResult(schema.validate({}))).toBe(false)
		expect(isSuccessResult(schema.validate(null))).toBe(false)
		expect(isSuccessResult(schema.validate(undefined))).toBe(false)
	})

	it('should use custom message for invalid instance error', () => {
		const schema = instance(MyClass, { INVALID_INSTANCE: 'Custom message' })
		const result = schema.validate(new AnotherClass())
		expect(isSuccessResult(result)).toBe(false)
		if (!isSuccessResult(result)) {
			expect(result.issues[0]?.message).toBe('Custom message')
		}
	})

	it('should return the instance on successful validation', () => {
		const schema = instance(MyClass)
		const myInstance = new MyClass()
		const result = schema.validate(myInstance)
		if (isSuccessResult(result)) {
			expect(result.value).toBe(myInstance)
		}
	})

	// Type Level Tests
	it('should infer types correctly', () => {
		const _s = instance(MyClass)
		type S = typeof _s
		expectTypeOf<S>().toExtend<ValSchema>()
		expectTypeOf<InferAsync<S>>().toEqualTypeOf<false>()
		expectTypeOf<InferMeta<S>>().toEqualTypeOf<{ constructor_: new (...args: any[]) => MyClass }>()
		expectTypeOf<InferInput<S>>().toEqualTypeOf<unknown>()
		expectTypeOf<InferOutput<S>>().toEqualTypeOf<MyClass>()
		expectTypeOf<InferIssueCode<S>>().toEqualTypeOf<'UNKNOWN_ERROR' | 'INVALID_INSTANCE'>()
		expectTypeOf<InferResult<S>>().toEqualTypeOf<ValidationResult<MyClass>>()
	})
})
