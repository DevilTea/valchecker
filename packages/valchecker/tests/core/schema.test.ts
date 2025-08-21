import type { DefineSchemaTypes, ValidationResult } from '../../src'
import { describe, expect, it, vi } from 'vitest'
import { AbstractSchema, implementSchemaClass, isSuccessResult, prependIssuePath } from '../../src'

// Mock Schema for testing AbstractSchema
class MockSchema extends AbstractSchema<DefineSchemaTypes<{ Meta: { foo: string }, Output: string, IssueCode: 'TEST_ERROR' }>> {}
class MockAsyncSchema extends AbstractSchema<DefineSchemaTypes<{ Async: true, Meta: { foo: string }, Output: string, IssueCode: 'TEST_ERROR' }>> {}

describe('abstractSchema', () => {
	it('should set meta and message in constructor', () => {
		const meta = { foo: 'bar' }
		const message = 'test message'
		const schema = new MockSchema({ meta, message })
		expect(schema.meta).toEqual(meta)
		expect(schema['~message']).toBe(message)
	})

	it('should call ~validate and return a success result', () => {
		const validateFn = vi.fn((value, { success }) => success(value))
		implementSchemaClass(MockSchema, { validate: validateFn })
		const schema = new MockSchema({ meta: { foo: 'bar' } })
		const result = schema.validate('test')
		expect(validateFn).toHaveBeenCalled()
		expect(isSuccessResult(result)).toBe(true)
		if (isSuccessResult(result)) {
			expect(result.value).toBe('test')
		}
	})

	it('should handle async success result from ~validate', async () => {
		const validateFn: any = vi.fn(async (value, { success }) => success(value))
		implementSchemaClass(MockAsyncSchema, { validate: validateFn })
		const schema = new MockAsyncSchema({ meta: { foo: 'bar' } })
		const result = await schema.validate('test')
		expect(validateFn).toHaveBeenCalled()
		expect(isSuccessResult(result)).toBe(true)
		if (isSuccessResult(result)) {
			expect(result.value).toBe('test')
		}
	})

	it('should handle sync error and return UNKNOWN_ERROR', () => {
		const error = new Error('test error')
		const validateFn = vi.fn(() => {
			throw error
		})
		implementSchemaClass(MockSchema, { validate: validateFn })
		const schema = new MockSchema({ meta: { foo: 'bar' } })
		const result = schema.validate('test')
		expect(isSuccessResult(result)).toBe(false)
		if (!isSuccessResult(result)) {
			expect(result.issues[0]?.code).toBe('UNKNOWN_ERROR')
			expect(result.issues[0]?.error).toBe(error)
		}
	})

	it('should handle async error and return UNKNOWN_ERROR', async () => {
		const error = new Error('test error')
		const validateFn: any = vi.fn(async () => {
			throw error
		})
		implementSchemaClass(MockAsyncSchema, { validate: validateFn })
		const schema = new MockAsyncSchema({ meta: { foo: 'bar' } })
		const result = await schema.validate('test')
		expect(isSuccessResult(result)).toBe(false)
		if (!isSuccessResult(result)) {
			expect(result.issues[0]?.code).toBe('UNKNOWN_ERROR')
			expect(result.issues[0]?.error).toBe(error)
		}
	})

	it('should have standard props', () => {
		const schema = new MockSchema({ meta: { foo: 'bar' } })
		expect(schema['~standard'].version).toBe(1)
		expect(schema['~standard'].vendor).toBe('valchecker')
		expect(typeof schema['~standard'].validate).toBe('function')
	})
})

describe('implementSchemaClass', () => {
	it('should add properties to the class prototype', () => {
		const defaultMessage = 'default message'
		const validate: any = () => {}
		implementSchemaClass(MockSchema, { defaultMessage, validate })
		expect(MockSchema.prototype['~defaultMessage']).toBe(defaultMessage)
		expect(MockSchema.prototype['~validate']).toBe(validate)
	})
})

describe('isSuccessResult', () => {
	it('should return true for success result', () => {
		const result: ValidationResult<string> = { value: 'test' }
		expect(isSuccessResult(result)).toBe(true)
	})

	it('should return false for failure result', () => {
		const result: ValidationResult<string> = { issues: [] }
		expect(isSuccessResult(result)).toBe(false)
	})
})

describe('prependIssuePath', () => {
	it('should prepend path to issue', () => {
		const issue = { code: 'TEST_ERROR', message: 'Test error', path: ['foo'] }
		const newIssue = prependIssuePath(issue, ['bar'])
		expect(newIssue.path).toEqual(['bar', 'foo'])
	})

	it('should handle empty path', () => {
		const issue = { code: 'TEST_ERROR', message: 'Test error', path: [] }
		const newIssue = prependIssuePath(issue, ['bar'])
		expect(newIssue.path).toEqual(['bar'])
	})
})
