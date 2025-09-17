import { describe, expect, it } from 'vitest'
import { isSuccessResult } from '../../core'
import { any, AnySchema } from './any'

describe('tests of `any`', () => {
	describe('happy path cases', () => {
		describe('case 1: Create any schema without parameters', () => {
			it('should return AnySchema instance', () => {
				const result = any()
				expect(result).toBeInstanceOf(AnySchema)
			})
		})
	})
	describe('edge cases', () => {
		describe('case 1: Validate various input types', () => {
			it('should accept null', async () => {
				const schema = any()
				const result = await schema.execute(null)
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe(null)
				}
			})
			it('should accept number', async () => {
				const schema = any()
				const result = await schema.execute(42)
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe(42)
				}
			})
			it('should accept string', async () => {
				const schema = any()
				const result = await schema.execute('string')
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe('string')
				}
			})
			it('should accept object', async () => {
				const schema = any()
				const obj = {}
				const result = await schema.execute(obj)
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe(obj)
				}
			})
			it('should accept array', async () => {
				const schema = any()
				const arr: unknown[] = []
				const result = await schema.execute(arr)
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe(arr)
				}
			})
		})
	})
})

describe('tests of `AnySchema`', () => {
	describe('happy path cases', () => {
		describe('case 1: Instantiate and validate', () => {
			it('should validate successfully', async () => {
				const schema = new AnySchema()
				const result = await schema.execute('test')
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe('test')
				}
			})
		})
	})
})
