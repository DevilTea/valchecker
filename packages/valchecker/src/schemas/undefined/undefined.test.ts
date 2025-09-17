import { describe, expect, it } from 'vitest'
import { isSuccessResult } from '../../core'
import { undefined_, UndefinedSchema } from './undefined'

describe('tests of `undefined_`', () => {
	describe('happy path cases', () => {
		describe('case 1: Create undefined schema without parameters', () => {
			it('should return UndefinedSchema instance', () => {
				const result = undefined_()
				expect(result).toBeInstanceOf(UndefinedSchema)
			})
		})
		describe('case 2: Create undefined schema with custom message', () => {
			it('should return UndefinedSchema instance with custom message', () => {
				const result = undefined_({ EXPECTED_UNDEFINED: 'Custom message' })
				expect(result).toBeInstanceOf(UndefinedSchema)
			})
		})
	})
	describe('edge cases', () => {
		describe('case 1: Validate undefined value', () => {
			it('should accept undefined', async () => {
				const schema = undefined_()
				const result = await schema.execute(undefined)
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe(undefined)
				}
			})
		})
		describe('case 2: Validate non-undefined values', () => {
			it('should reject null', async () => {
				const schema = undefined_()
				const result = await schema.execute(null)
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_UNDEFINED')
					}
				}
			})
			it('should reject number', async () => {
				const schema = undefined_()
				const result = await schema.execute(0)
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_UNDEFINED')
					}
				}
			})
			it('should reject string', async () => {
				const schema = undefined_()
				const result = await schema.execute('')
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_UNDEFINED')
					}
				}
			})
			it('should reject object', async () => {
				const schema = undefined_()
				const result = await schema.execute({})
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_UNDEFINED')
					}
				}
			})
		})
	})
})

describe('tests of `UndefinedSchema`', () => {
	describe('happy path cases', () => {
		describe('case 1: Instantiate and validate', () => {
			it('should validate successfully', async () => {
				const schema = new UndefinedSchema()
				const result = await schema.execute(undefined)
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe(undefined)
				}
			})
		})
	})
})
