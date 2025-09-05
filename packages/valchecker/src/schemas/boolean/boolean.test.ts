import { describe, expect, it } from 'vitest'
import { isSuccessResult } from '../../core'
import { boolean, BooleanSchema } from './boolean'

describe('tests of `boolean`', () => {
	describe('happy path cases', () => {
		describe('case 1: Create boolean schema without parameters', () => {
			it('should return BooleanSchema instance', () => {
				const result = boolean()
				expect(result).toBeInstanceOf(BooleanSchema)
			})
		})
		describe('case 2: Create boolean schema with custom message', () => {
			it('should return BooleanSchema instance with custom message', () => {
				const result = boolean({ EXPECTED_BOOLEAN: 'Custom message' })
				expect(result).toBeInstanceOf(BooleanSchema)
			})
		})
	})
	describe('edge cases', () => {
		describe('case 1: Validate boolean values', () => {
			it('should accept true', async () => {
				const schema = boolean()
				const result = await schema.validate(true)
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe(true)
				}
			})
			it('should accept false', async () => {
				const schema = boolean()
				const result = await schema.validate(false)
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe(false)
				}
			})
		})
		describe('case 2: Validate non-boolean values', () => {
			it('should reject number', async () => {
				const schema = boolean()
				const result = await schema.validate(1)
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_BOOLEAN')
					}
				}
			})
			it('should reject string', async () => {
				const schema = boolean()
				const result = await schema.validate('string')
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_BOOLEAN')
					}
				}
			})
			it('should reject null', async () => {
				const schema = boolean()
				const result = await schema.validate(null)
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_BOOLEAN')
					}
				}
			})
			it('should reject object', async () => {
				const schema = boolean()
				const result = await schema.validate({})
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_BOOLEAN')
					}
				}
			})
		})
	})
})

describe('tests of `BooleanSchema`', () => {
	describe('happy path cases', () => {
		describe('case 1: Instantiate and validate', () => {
			it('should validate successfully', async () => {
				const schema = new BooleanSchema()
				const result = await schema.validate(true)
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe(true)
				}
			})
		})
	})
})
