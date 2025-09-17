import { describe, expect, it } from 'vitest'
import { isSuccessResult } from '../../core'
import { string, StringSchema } from './string'

describe('tests of `string`', () => {
	describe('happy path cases', () => {
		describe('case 1: Create string schema without parameters', () => {
			it('should return StringSchema instance', () => {
				const result = string()
				expect(result).toBeInstanceOf(StringSchema)
			})
		})
		describe('case 2: Create string schema with custom message', () => {
			it('should return StringSchema instance with custom message', () => {
				const result = string({ EXPECTED_STRING: 'Custom message' })
				expect(result).toBeInstanceOf(StringSchema)
			})
		})
	})
	describe('edge cases', () => {
		describe('case 1: Validate string values', () => {
			it('should accept non-empty string', async () => {
				const schema = string()
				const result = await schema.execute('hello')
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe('hello')
				}
			})
			it('should accept empty string', async () => {
				const schema = string()
				const result = await schema.execute('')
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe('')
				}
			})
		})
		describe('case 2: Validate non-string values', () => {
			it('should reject number', async () => {
				const schema = string()
				const result = await schema.execute(123)
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_STRING')
					}
				}
			})
			it('should reject null', async () => {
				const schema = string()
				const result = await schema.execute(null)
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_STRING')
					}
				}
			})
			it('should reject object', async () => {
				const schema = string()
				const result = await schema.execute({})
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_STRING')
					}
				}
			})
			it('should reject array', async () => {
				const schema = string()
				const result = await schema.execute([])
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_STRING')
					}
				}
			})
		})
	})
})

describe('tests of `StringSchema`', () => {
	describe('happy path cases', () => {
		describe('case 1: Instantiate and validate', () => {
			it('should validate successfully', async () => {
				const schema = new StringSchema()
				const result = await schema.execute('test')
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe('test')
				}
			})
		})
	})
})
