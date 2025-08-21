import type { InferAsync, InferInput, InferIssueCode, InferMeta, InferOutput, InferResult, ValidationResult, ValSchema } from '../../src'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { isSuccessResult, symbol } from '../../src'

describe('symbol schema', () => {
	it('should validate any symbol', () => {
		const schema = symbol()
		expect(isSuccessResult(schema.validate(Symbol('foo')))).toBe(true)
		expect(isSuccessResult(schema.validate(Symbol.iterator))).toBe(true)
	})

	it('should fail for non-symbol values', () => {
		const schema = symbol()
		expect(isSuccessResult(schema.validate('foo'))).toBe(false)
		expect(isSuccessResult(schema.validate(123))).toBe(false)
		expect(isSuccessResult(schema.validate(null))).toBe(false)
		expect(isSuccessResult(schema.validate(undefined))).toBe(false)
		expect(isSuccessResult(schema.validate({}))).toBe(false)
		expect(isSuccessResult(schema.validate([]))).toBe(false)
	})

	it('should use custom message for expected symbol error', () => {
		const schema = symbol({ EXPECTED_SYMBOL: 'Custom message' })
		const result = schema.validate('not a symbol')
		expect(isSuccessResult(result)).toBe(false)
		if (!isSuccessResult(result)) {
			expect(result.issues[0]?.message).toBe('Custom message')
		}
	})

	it('should return the correct value on successful validation', () => {
		const mySymbol = Symbol('test')
		const schema = symbol()
		const result = schema.validate(mySymbol)
		if (isSuccessResult(result)) {
			expect(result.value).toBe(mySymbol)
		}
	})

	// Type Level Tests
	it('should infer types correctly', () => {
		const _s = symbol()
		type S = typeof _s
		expectTypeOf<S>().toExtend<ValSchema>()
		expectTypeOf<InferAsync<S>>().toEqualTypeOf<false>()
		expectTypeOf<InferMeta<S>>().toEqualTypeOf<null>()
		expectTypeOf<InferInput<S>>().toEqualTypeOf<unknown>()
		expectTypeOf<InferOutput<S>>().toEqualTypeOf<symbol>()
		expectTypeOf<InferIssueCode<S>>().toEqualTypeOf<'UNKNOWN_ERROR' | 'EXPECTED_SYMBOL'>()
		expectTypeOf<InferResult<S>>().toEqualTypeOf<ValidationResult<symbol>>()
	})
})
