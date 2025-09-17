import { describe, expect, it } from 'vitest'
import { isSuccessResult } from '../../core'
import { instance, InstanceSchema } from './instance'

class TestClass {
	constructor(public value: string = 'test') {}
}

describe('tests of `instance`', () => {
	describe('happy path cases', () => {
		describe('case 1: Create instance schema for a class', () => {
			it('should return InstanceSchema instance', () => {
				const result = instance(TestClass)
				expect(result).toBeInstanceOf(InstanceSchema)
			})
		})
		describe('case 2: Create instance schema with custom message', () => {
			it('should return InstanceSchema instance with custom message', () => {
				const result = instance(TestClass, { INVALID_INSTANCE: 'Custom message' })
				expect(result).toBeInstanceOf(InstanceSchema)
			})
		})
	})
	describe('edge cases', () => {
		describe('case 1: Validate instance of the constructor', () => {
			it('should accept instance of the class', async () => {
				const schema = instance(TestClass)
				const instance_ = new TestClass()
				const result = await schema.execute(instance_)
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe(instance_)
				}
			})
		})
		describe('case 2: Validate non-instance values', () => {
			it('should reject plain object', async () => {
				const schema = instance(TestClass)
				const result = await schema.execute({})
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('INVALID_INSTANCE')
					}
				}
			})
			it('should reject null', async () => {
				const schema = instance(TestClass)
				const result = await schema.execute(null)
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('INVALID_INSTANCE')
					}
				}
			})
			it('should reject string', async () => {
				const schema = instance(TestClass)
				const result = await schema.execute('string')
				expect(isSuccessResult(result)).toBe(false)
				if (!isSuccessResult(result)) {
					expect(result.issues).toBeDefined()
					expect(result.issues.length).toBeGreaterThan(0)
					if (result.issues.length > 0) {
						expect(result.issues[0]!.code).toBe('INVALID_INSTANCE')
					}
				}
			})
		})
	})
})

describe('tests of `InstanceSchema`', () => {
	describe('happy path cases', () => {
		describe('case 1: Instantiate and validate', () => {
			it('should validate successfully', async () => {
				const schema = new InstanceSchema({ meta: { constructor_: TestClass } })
				const instance_ = new TestClass()
				const result = await schema.execute(instance_)
				expect(isSuccessResult(result)).toBe(true)
				if (isSuccessResult(result)) {
					expect(result.value).toBe(instance_)
				}
			})
		})
	})
})
