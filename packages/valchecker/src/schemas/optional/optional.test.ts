import { describe, expect, it } from 'vitest'
import { AbstractSchema, implementSchemaClass, isSuccessResult } from '../../core'
import { string } from '../string'
import { optional, OptionalSchema, unwrapOptional } from './optional'

describe('tests of `optional`', () => {
	describe('happy path cases', () => {
		it('case 1: Create optional schema from string schema', () => {
			const schema = optional(string())
			expect(schema).toBeInstanceOf(OptionalSchema)
		})

		it('case 2: Validate undefined value with optional schema', async () => {
			const schema = optional(string())
			const result = await schema.execute(undefined)
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe(undefined)
			}
		})

		it('case 3: Validate valid value with optional schema', async () => {
			const schema = optional(string())
			const result = await schema.execute('test')
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe('test')
			}
		})
	})

	describe('edge cases', () => {
		it('case 1: Validate null value with optional schema', async () => {
			const schema = optional(string())
			const result = await schema.execute(null)
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(1)
				expect(result.issues[0]!.message).toBe('Expected string.')
			}
		})

		it('case 2: Validate invalid value with optional schema', async () => {
			const schema = optional(string())
			const result = await schema.execute(123)
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(1)
				expect(result.issues[0]!.message).toBe('Expected string.')
			}
		})

		it('case 3: Double optional wrapping', () => {
			const schema = optional(optional(string()))
			expect(schema).toBeInstanceOf(OptionalSchema)
			// The double optional should be unwrapped internally
			expect(schema.meta.schema).toBeInstanceOf(string().constructor)
		})

		it('case 4: Optional with transformed schema', async () => {
			class SimpleTransformedSchema extends AbstractSchema<{ async: false, transformed: true, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

			implementSchemaClass(SimpleTransformedSchema, {
				isTransformed: () => true,
				execute: (value, { success }) => success(`${value} transformed`),
			})

			const transformedSchema = new SimpleTransformedSchema()
			const schema = optional(transformedSchema)
			const result = await schema.execute('input')
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe('input transformed')
			}
		})

		it('case 5: Optional with async schema', async () => {
			class SimpleAsyncSchema extends AbstractSchema<{ async: true, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

			implementSchemaClass(SimpleAsyncSchema, {
				isTransformed: () => false,
				execute: async (value, { success }) => {
					// Simulate async operation
					await new Promise(resolve => setTimeout(resolve, 1))
					return success(`${value} async`)
				},
			})

			const asyncSchema = new SimpleAsyncSchema()
			const schema = optional(asyncSchema)
			const result = await schema.execute('input')
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe('input async')
			}
		})
	})
})

describe('tests of `OptionalSchema`', () => {
	describe('happy path cases', () => {
		it('case 1: Instantiate and validate undefined', async () => {
			const schema = new OptionalSchema({ meta: { schema: string() } })
			const result = await schema.execute(undefined)
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe(undefined)
			}
		})

		it('case 2: Instantiate and validate valid value', async () => {
			const schema = new OptionalSchema({ meta: { schema: string() } })
			const result = await schema.execute('test')
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe('test')
			}
		})
	})

	describe('edge cases', () => {
		it('case 1: Validate with transformed inner schema', async () => {
			class SimpleTransformedSchema extends AbstractSchema<{ async: false, transformed: true, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

			implementSchemaClass(SimpleTransformedSchema, {
				isTransformed: () => true,
				execute: (value, { success }) => success(`${value} transformed`),
			})

			const transformedSchema = new SimpleTransformedSchema()
			const schema = new OptionalSchema({ meta: { schema: transformedSchema } })
			const result = await schema.execute('input')
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toBe('input transformed')
			}
		})
	})
})

describe('tests of `unwrapOptional`', () => {
	describe('happy path cases', () => {
		it('case 1: Unwrap optional schema', () => {
			const innerSchema = string()
			const optionalSchema = optional(innerSchema)
			const unwrapped = unwrapOptional(optionalSchema)
			expect(unwrapped).toBe(innerSchema)
		})

		it('case 2: Unwrap non-optional schema', () => {
			const innerSchema = string()
			const unwrapped = unwrapOptional(innerSchema)
			expect(unwrapped).toBe(innerSchema)
		})
	})

	describe('edge cases', () => {
		it('case 1: Unwrap double optional', () => {
			const innerSchema = string()
			const doubleOptional = optional(optional(innerSchema))
			const unwrapped = unwrapOptional(doubleOptional)
			expect(unwrapped).toBe(innerSchema)
		})
	})
})
