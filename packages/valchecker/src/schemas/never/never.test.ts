import { describe, expect, it } from 'vitest'
import { isSuccessResult } from '../../core'
import { never, NeverSchema } from './never'

describe('tests of `never`', () => {
	describe('happy path cases', () => {
		describe('case 1: Create never schema without parameters', () => {
			it('should return NeverSchema instance', () => {
				const result = never()
				expect(result).toBeInstanceOf(NeverSchema)
			})
		})
		describe('case 2: Create never schema with custom message', () => {
			it('should return NeverSchema instance with custom message', () => {
				const result = never({ EXPECTED_NEVER: 'Custom message' })
				expect(result).toBeInstanceOf(NeverSchema)
			})
		})
	})
	describe('edge cases', () => {
		describe('case 1: Validate any value', () => {
			it('should reject null', async () => {
				const schema = never()
				const result = await schema.validate(null)
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_NEVER')
					}
				}
			})
			it('should reject number', async () => {
				const schema = never()
				const result = await schema.validate(42)
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_NEVER')
					}
				}
			})
			it('should reject string', async () => {
				const schema = never()
				const result = await schema.validate('string')
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_NEVER')
					}
				}
			})
			it('should reject object', async () => {
				const schema = never()
				const result = await schema.validate({})
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_NEVER')
					}
				}
			})
		})
	})
})

describe('tests of `NeverSchema`', () => {
	describe('happy path cases', () => {
		describe('case 1: Instantiate and validate', () => {
			it('should validate and fail', async () => {
				const schema = new NeverSchema()
				const result = await schema.validate('test')
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_NEVER')
					}
				}
			})
		})
	})
})
