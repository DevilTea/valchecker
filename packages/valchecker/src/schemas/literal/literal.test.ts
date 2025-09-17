import { describe, expect, it } from 'vitest'
import { isSuccessResult } from '../../core'
import { literal, LiteralSchema } from './literal'

describe('tests of `literal`', () => {
	describe('happy path cases', () => {
		it('case 1: Create literal schema with string', () => {
			const schema = literal('hello')
			expect(schema).toBeInstanceOf(LiteralSchema)
		})

		it('case 2: Create literal schema with number', () => {
			const schema = literal(42)
			expect(schema).toBeInstanceOf(LiteralSchema)
		})

		it('case 3: Create literal schema with boolean', () => {
			const schema = literal(true)
			expect(schema).toBeInstanceOf(LiteralSchema)
		})

		it('case 4: Create literal schema with bigint', () => {
			const schema = literal(123n)
			expect(schema).toBeInstanceOf(LiteralSchema)
		})

		it('case 5: Create literal schema with symbol', () => {
			const sym = Symbol('test')
			const schema = literal(sym)
			expect(schema).toBeInstanceOf(LiteralSchema)
		})
	})

	describe('edge cases', () => {
		it('case 1: Validate matching string literal', () => {
			const schema = literal('hello')
			const result = schema.execute('hello')
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe('hello')
			}
		})

		it('case 2: Validate matching number literal', () => {
			const schema = literal(42)
			const result = schema.execute(42)
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe(42)
			}
		})

		it('case 3: Validate matching boolean literal', () => {
			const schema = literal(true)
			const result = schema.execute(true)
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe(true)
			}
		})

		it('case 4: Validate matching bigint literal', () => {
			const schema = literal(123n)
			const result = schema.execute(123n)
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe(123n)
			}
		})

		it('case 5: Validate matching symbol literal', () => {
			const sym = Symbol('test')
			const schema = literal(sym)
			const result = schema.execute(sym)
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe(sym)
			}
		})

		it('case 6: Validate NaN literal', () => {
			const schema = literal(Number.NaN)
			const result = schema.execute(Number.NaN)
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(Number.isNaN(result.value)).toBe(true)
			}
		})

		it('case 7: Validate non-matching value', () => {
			const schema = literal('hello')
			const result = schema.execute('world')
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(1)
				expect(result.issues[0]!.message).toBe('Invalid value.')
			}
		})

		it('case 8: Validate NaN against non-NaN literal', () => {
			const schema = literal(42)
			const result = schema.execute(Number.NaN)
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(1)
				expect(result.issues[0]!.message).toBe('Invalid value.')
			}
		})

		it('case 9: Validate non-NaN against NaN literal', () => {
			const schema = literal(Number.NaN)
			const result = schema.execute(42)
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(1)
				expect(result.issues[0]!.message).toBe('Invalid value.')
			}
		})
	})
})

describe('tests of `LiteralSchema`', () => {
	describe('happy path cases', () => {
		it('case 1: Instantiate and validate', () => {
			const schema = new LiteralSchema({ meta: { value: 'test' } })
			const result = schema.execute('test')
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe('test')
			}
		})
	})
})
