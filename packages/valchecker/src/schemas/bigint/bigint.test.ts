import { describe, expect, it } from 'vitest'
import { isSuccessResult } from '../../core'
import { bigint, BigintSchema } from './bigint'

describe('tests of `bigint`', () => {
	describe('happy path cases', () => {
		describe('case 1: Create bigint schema without parameters', () => {
			it('should return BigintSchema instance', () => {
				const result = bigint()
				expect(result).toBeInstanceOf(BigintSchema)
			})
		})
		describe('case 2: Create bigint schema with custom message', () => {
			it('should return BigintSchema instance with custom message', () => {
				const result = bigint({ EXPECTED_BIGINT: 'Custom message' })
				expect(result).toBeInstanceOf(BigintSchema)
			})
		})
	})
	describe('edge cases', () => {
		describe('case 1: Validate bigint values', () => {
			it('should accept literal bigint', async () => {
				const schema = bigint()
				const result = await schema.execute(123n)
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe(123n)
				}
			})
			it('should accept BigInt constructor', async () => {
				const schema = bigint()
				const result = await schema.execute(BigInt(456))
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe(456n)
				}
			})
		})
		describe('case 2: Validate non-bigint values', () => {
			it('should reject number', async () => {
				const schema = bigint()
				const result = await schema.execute(123)
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_BIGINT')
					}
				}
			})
			it('should reject string', async () => {
				const schema = bigint()
				const result = await schema.execute('string')
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_BIGINT')
					}
				}
			})
			it('should reject null', async () => {
				const schema = bigint()
				const result = await schema.execute(null)
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_BIGINT')
					}
				}
			})
			it('should reject object', async () => {
				const schema = bigint()
				const result = await schema.execute({})
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('EXPECTED_BIGINT')
					}
				}
			})
		})
	})
})

describe('tests of `BigintSchema`', () => {
	describe('happy path cases', () => {
		describe('case 1: Instantiate and validate', () => {
			it('should validate successfully', async () => {
				const schema = new BigintSchema()
				const result = await schema.execute(789n)
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe(789n)
				}
			})
		})
	})
})
