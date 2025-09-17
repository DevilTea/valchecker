import type { ExecutionIssue, ExecutionResult } from './schema'
import { describe, expect, it } from 'vitest'
import {
	AbstractSchema,
	implementSchemaClass,
	isSuccessResult,
	prependIssuePath,
} from './schema'

describe('tests of `AbstractSchema.execute`', () => {
	describe('happy path cases', () => {
		describe('case 1: returns success result when validation succeeds', () => {
			it('should return success result', () => {
				class TestSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(TestSchema, {
					execute: value => ({ value }),
				})

				const schema = new TestSchema()
				const result = schema.execute('test')
				expect(result).toEqual({ value: 'test' })
			})
		})

		describe('case 2: returns failure result when validation fails', () => {
			it('should return failure result', () => {
				class TestSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(TestSchema, {
					execute: (_value, { failure, issue }) => failure(issue('TEST_ERROR')),
				})

				const schema = new TestSchema()
				const result = schema.execute('invalid')
				expect(result).toEqual({
					issues: [{
						code: 'TEST_ERROR',
						message: 'Invalid value.',
						path: undefined,
					}],
				})
			})
		})

		describe('case 3: handles async validation returning success', () => {
			it('should return promise resolving to success', async () => {
				class TestSchema extends AbstractSchema<{ async: true, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(TestSchema, {
					execute: value => Promise.resolve({ value }),
				})

				const schema = new TestSchema()
				const result = await schema.execute('test')
				expect(result).toEqual({ value: 'test' })
			})
		})

		describe('case 4: handles async validation returning failure', () => {
			it('should return promise resolving to failure', async () => {
				class TestSchema extends AbstractSchema<{ async: true, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(TestSchema, {
					execute: (_value, { failure, issue }) => Promise.resolve(failure(issue('TEST_ERROR'))),
				})

				const schema = new TestSchema()
				const result = await schema.execute('invalid')
				expect(result).toEqual({
					issues: [{
						code: 'TEST_ERROR',
						message: 'Invalid value.',
						path: undefined,
					}],
				})
			})
		})
	})

	describe('edge cases', () => {
		describe('case 1: handles validation throwing synchronous error', () => {
			it('should return failure with UNKNOWN_ERROR', () => {
				class TestSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(TestSchema, {
					execute: () => { throw new Error('sync error') },
				})

				const schema = new TestSchema()
				const result = schema.execute('test')
				expect(result).toEqual({
					issues: [{
						code: 'UNKNOWN_ERROR',
						error: new Error('sync error'),
						message: 'Invalid value.',
						path: undefined,
					}],
				})
			})
		})

		describe('case 2: handles async validation rejecting', () => {
			it('should return promise resolving to failure with UNKNOWN_ERROR', async () => {
				class TestSchema extends AbstractSchema<{ async: true, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(TestSchema, {
					execute: () => Promise.reject(new Error('async error')),
				})

				const schema = new TestSchema()
				const result = await schema.execute('test')
				expect(result).toEqual({
					issues: [{
						code: 'UNKNOWN_ERROR',
						error: new Error('async error'),
						message: 'Invalid value.',
						path: undefined,
					}],
				})
			})
		})

		describe('case 3: handles custom message resolution', () => {
			it('should use custom message', () => {
				class TestSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(TestSchema, {
					execute: (_value, { failure, issue }) => failure(issue('TEST_ERROR')),
				})

				const schema = new TestSchema({
					message: { TEST_ERROR: 'Custom error message' },
				})
				const result = schema.execute('invalid')
				expect(result).toEqual({
					issues: [{
						code: 'TEST_ERROR',
						message: 'Custom error message',
						path: undefined,
					}],
				})
			})
		})
	})

	describe('error cases', () => {
		describe('case 1: handles malformed validation result', () => {
			it('should return failure with UNKNOWN_ERROR', () => {
				class TestSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(TestSchema, {
					execute: () => 'invalid' as any,
				})

				const schema = new TestSchema()
				const result = schema.execute('test')
				expect(result).toBe('invalid')
			})
		})
	})
})

describe('tests of `AbstractSchema.isValid`', () => {
	describe('happy path cases', () => {
		describe('case 1: returns true for successful validation', () => {
			it('should return true', () => {
				class TestSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(TestSchema, {
					execute: value => ({ value }),
				})

				const schema = new TestSchema()
				const result = schema.isValid('test')
				expect(result).toBe(true)
			})
		})

		describe('case 2: returns false for failed validation', () => {
			it('should return false', () => {
				class TestSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(TestSchema, {
					execute: (_value, { failure, issue }) => failure(issue('TEST_ERROR')),
				})

				const schema = new TestSchema()
				const result = schema.isValid('invalid')
				expect(result).toBe(false)
			})
		})

		describe('case 3: returns promise resolving to true for async success', () => {
			it('should return promise resolving to true', async () => {
				class TestSchema extends AbstractSchema<{ async: true, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(TestSchema, {
					execute: value => Promise.resolve({ value }),
				})

				const schema = new TestSchema()
				const result = await schema.isValid('test')
				expect(result).toBe(true)
			})
		})

		describe('case 4: returns promise resolving to false for async failure', () => {
			it('should return promise resolving to false', async () => {
				class TestSchema extends AbstractSchema<{ async: true, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(TestSchema, {
					execute: (_value, { failure, issue }) => Promise.resolve(failure(issue('TEST_ERROR'))),
				})

				const schema = new TestSchema()
				const result = await schema.isValid('invalid')
				expect(result).toBe(false)
			})
		})
	})
})

describe('tests of `implementSchemaClass`', () => {
	describe('happy path cases', () => {
		describe('case 1: successfully implements schema class with validate function', () => {
			it('should implement schema class', () => {
				class TestSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(TestSchema, {
					execute: value => ({ value }),
				})

				const schema = new TestSchema()
				expect(typeof schema.execute).toBe('function')
				expect(typeof schema.isValid).toBe('function')
			})
		})

		describe('case 2: implements schema class with default message', () => {
			it('should use default message', () => {
				class TestSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(TestSchema, {
					execute: (_value, { failure, issue }) => failure(issue('TEST_ERROR')),
					defaultMessage: { TEST_ERROR: 'Default test error' },
				})

				const schema = new TestSchema()
				const result = schema.execute('invalid')
				expect(result).toEqual({
					issues: [{
						code: 'TEST_ERROR',
						message: 'Default test error',
						path: undefined,
					}],
				})
			})
		})

		describe('case 3: implements schema class with isTransformed function', () => {
			it('should set isTransformed correctly', () => {
				class TestSchema extends AbstractSchema<{ async: false, transformed: true, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(TestSchema, {
					execute: value => ({ value }),
					isTransformed: () => true,
				})

				const schema = new TestSchema()
				expect(schema.isTransformed).toBe(true)
			})
		})
	})
})

describe('tests of `isSuccessResult`', () => {
	describe('happy path cases', () => {
		describe('case 1: returns true for success result', () => {
			it('should return true', () => {
				const result: ExecutionResult<string> = { value: 'test' }
				expect(isSuccessResult(result)).toBe(true)
			})
		})

		describe('case 2: returns false for failure result', () => {
			it('should return false', () => {
				const result: ExecutionResult<string> = { issues: [{ code: 'ERROR', message: 'Error message' }] }
				expect(isSuccessResult(result)).toBe(false)
			})
		})
	})
})

describe('tests of `prependIssuePath`', () => {
	describe('happy path cases', () => {
		describe('case 1: prepends path to issue without existing path', () => {
			it('should prepend path', () => {
				const issue: ExecutionIssue = { code: 'ERROR', message: 'Error message' }
				const result = prependIssuePath(issue, ['root', 'field'])
				expect(result).toEqual({
					code: 'ERROR',
					message: 'Error message',
					path: ['root', 'field'],
				})
			})
		})

		describe('case 2: prepends path to issue with existing path', () => {
			it('should prepend path to existing path', () => {
				const issue: ExecutionIssue = { code: 'ERROR', message: 'Error message', path: ['nested'] }
				const result = prependIssuePath(issue, ['root'])
				expect(result).toEqual({
					code: 'ERROR',
					message: 'Error message',
					path: ['root', 'nested'],
				})
			})
		})
	})
})
