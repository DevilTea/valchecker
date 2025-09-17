import { describe, expect, it } from 'vitest'
import { isSuccessResult } from '../../core'
import { symbol, SymbolSchema } from './symbol'

describe('tests of `symbol`', () => {
	describe('happy path cases', () => {
		describe('case 1: Create symbol schema without parameters', () => {
			it('should return SymbolSchema instance', () => {
				const result = symbol()
				expect(result).toBeInstanceOf(SymbolSchema)
			})
		})
		describe('case 2: Create symbol schema with custom message', () => {
			it('should return SymbolSchema instance with custom message', () => {
				const result = symbol({ EXPECTED_SYMBOL: 'Custom message' })
				expect(result).toBeInstanceOf(SymbolSchema)
			})
		})
	})
	describe('edge cases', () => {
		describe('case 1: Validate symbol values', () => {
			it('should accept anonymous symbol', async () => {
				const schema = symbol()
				const sym = Symbol('anonymous')
				const result = await schema.execute(sym)
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe(sym)
				}
			})
			it('should accept named symbol', async () => {
				const schema = symbol()
				const sym = Symbol('test')
				const result = await schema.execute(sym)
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe(sym)
				}
			})
		})
		describe('case 2: Validate non-symbol values', () => {
			it('should reject string', async () => {
				const schema = symbol()
				const result = await schema.execute('string')
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_SYMBOL')
					}
				}
			})
			it('should reject number', async () => {
				const schema = symbol()
				const result = await schema.execute(123)
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_SYMBOL')
					}
				}
			})
			it('should reject null', async () => {
				const schema = symbol()
				const result = await schema.execute(null)
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_SYMBOL')
					}
				}
			})
			it('should reject object', async () => {
				const schema = symbol()
				const result = await schema.execute({})
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_SYMBOL')
					}
				}
			})
		})
	})
})

describe('tests of `SymbolSchema`', () => {
	describe('happy path cases', () => {
		describe('case 1: Instantiate and validate', () => {
			it('should validate successfully', async () => {
				const schema = new SymbolSchema()
				const sym = Symbol('test')
				const result = await schema.execute(sym)
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe(sym)
				}
			})
		})
	})
})
