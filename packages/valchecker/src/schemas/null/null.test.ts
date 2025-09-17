import { describe, expect, it } from 'vitest'
import { isSuccessResult } from '../../core'
import { null_, NullSchema } from './null'

describe('tests of `null_`', () => {
	describe('happy path cases', () => {
		describe('case 1: Create null schema without parameters', () => {
			it('should return NullSchema instance', () => {
				const result = null_()
				expect(result).toBeInstanceOf(NullSchema)
			})
		})
		describe('case 2: Create null schema with custom message', () => {
			it('should return NullSchema instance with custom message', () => {
				const result = null_({ EXPECTED_NULL: 'Custom message' })
				expect(result).toBeInstanceOf(NullSchema)
			})
		})
	})
	describe('edge cases', () => {
		describe('case 1: Validate null value', () => {
			it('should accept null', async () => {
				const schema = null_()
				const result = await schema.execute(null)
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe(null)
				}
			})
		})
		describe('case 2: Validate non-null values', () => {
			it('should reject undefined', async () => {
				const schema = null_()
				const result = await schema.execute(undefined)
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_NULL')
					}
				}
			})
			it('should reject number', async () => {
				const schema = null_()
				const result = await schema.execute(0)
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_NULL')
					}
				}
			})
			it('should reject string', async () => {
				const schema = null_()
				const result = await schema.execute('')
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_NULL')
					}
				}
			})
			it('should reject object', async () => {
				const schema = null_()
				const result = await schema.execute({})
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_NULL')
					}
				}
			})
		})
	})
})

describe('tests of `NullSchema`', () => {
	describe('happy path cases', () => {
		describe('case 1: Instantiate and validate', () => {
			it('should validate successfully', async () => {
				const schema = new NullSchema()
				const result = await schema.execute(null)
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe(null)
				}
			})
		})
	})
})
