import { describe, expect, it } from 'vitest'
import { isSuccessResult } from '../../core'
import { unknown, UnknownSchema } from './unknown'

describe('tests of `unknown`', () => {
	describe('happy path cases', () => {
		describe('case 1: Create unknown schema', () => {
			it('should return UnknownSchema instance', () => {
				const result = unknown()
				expect(result).toBeInstanceOf(UnknownSchema)
			})
		})
	})
	describe('edge cases', () => {
		describe('case 1: Validate various input types', () => {
			it('should accept null', async () => {
				const schema = unknown()
				const result = await schema.validate(null)
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe(null)
				}
			})
			it('should accept number', async () => {
				const schema = unknown()
				const result = await schema.validate(42)
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe(42)
				}
			})
			it('should accept string', async () => {
				const schema = unknown()
				const result = await schema.validate('string')
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe('string')
				}
			})
			it('should accept object', async () => {
				const schema = unknown()
				const obj = {}
				const result = await schema.validate(obj)
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe(obj)
				}
			})
			it('should accept array', async () => {
				const schema = unknown()
				const arr: unknown[] = []
				const result = await schema.validate(arr)
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe(arr)
				}
			})
		})
	})
})

describe('tests of `UnknownSchema`', () => {
	describe('happy path cases', () => {
		describe('case 1: Instantiate and validate', () => {
			it('should validate successfully', async () => {
				const schema = new UnknownSchema()
				const result = await schema.validate('test')
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe('test')
				}
			})
		})
	})
})
