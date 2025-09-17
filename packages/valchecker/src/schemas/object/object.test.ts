import { describe, expect, it } from 'vitest'
import { AbstractSchema, implementSchemaClass, isSuccessResult } from '../../core'
import { number } from '../number'
import { optional } from '../optional'
import { string } from '../string'
import { object, ObjectSchema } from './object'

describe('tests of `object`', () => {
	describe('happy path cases', () => {
		it('case 1: Create object schema with simple structure', () => {
			const schema = object({ name: string() })
			expect(schema).toBeInstanceOf(ObjectSchema)
		})

		it('case 2: Create object schema with custom message', () => {
			const schema = object({ name: string() }, { EXPECTED_OBJECT: 'Custom message' })
			expect(schema).toBeInstanceOf(ObjectSchema)
		})
	})

	describe('edge cases', () => {
		it('case 1: Validate object with valid properties', async () => {
			const schema = object({ name: string() })
			const result = await schema.execute({ name: 'John' })
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toEqual({ name: 'John' })
			}
		})

		it('case 2: Validate object with invalid properties', async () => {
			const schema = object({ name: string() })
			const result = await schema.execute({ name: 123 })
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(1)
				expect(result.issues[0]!.message).toBe('Expected string.')
				expect(result.issues[0]!.path).toEqual(['name'])
			}
		})

		it('case 3: Validate object with missing properties', async () => {
			const schema = object({ name: string() })
			const result = await schema.execute({})
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(1)
				expect(result.issues[0]!.message).toBe('Expected string.')
				expect(result.issues[0]!.path).toEqual(['name'])
			}
		})

		it('case 4: Validate object with extra properties', async () => {
			const schema = object({ name: string() })
			const result = await schema.execute({ name: 'John', age: 30 })
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toEqual({ name: 'John', age: 30 })
			}
		})

		it('case 5: Validate non-object value', async () => {
			const schema = object({ name: string() })
			const result = await schema.execute('not an object')
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(1)
				expect(result.issues[0]!.message).toBe('Expected an object.')
			}
		})

		it('case 6: Validate null value', async () => {
			const schema = object({ name: string() })
			const result = await schema.execute(null)
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(1)
				expect(result.issues[0]!.message).toBe('Expected an object.')
			}
		})

		it('case 7: Validate array value', async () => {
			const schema = object({ name: string() })
			const result = await schema.execute([])
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(1)
				expect(result.issues[0]!.message).toBe('Expected an object.')
			}
		})

		it('case 8: Validate complex object structure', async () => {
			const schema = object({
				name: string(),
				age: number(),
				active: string(), // This will fail since boolean != string
			})
			const result = await schema.execute({
				name: 'John',
				age: 30,
				active: true,
			})
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(1)
				expect(result.issues[0]!.message).toBe('Expected string.')
				expect(result.issues[0]!.path).toEqual(['active'])
			}
		})

		it('case 9: Validate undefined value', async () => {
			const schema = object({ name: string() })
			const result = await schema.execute(undefined)
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(1)
				expect(result.issues[0]!.message).toBe('Expected an object.')
			}
		})

		it('case 10: Validate with custom error message', async () => {
			const schema = object({ name: string() }, { EXPECTED_OBJECT: 'Custom error message' })
			const result = await schema.execute('invalid')
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(1)
				expect(result.issues[0]!.message).toBe('Custom error message')
			}
		})

		it('case 11: Validate with optional properties present', async () => {
			const schema = object({ name: string(), optional: optional(string()) })
			const result = await schema.execute({ name: 'John', optional: 'value' })
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toEqual({ name: 'John', optional: 'value' })
			}
		})

		it('case 12: Validate with optional properties missing', async () => {
			const schema = object({ name: string(), optional: optional(string()) })
			const result = await schema.execute({ name: 'John' })
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toEqual({ name: 'John', optional: undefined })
			}
		})

		it('case 13: Validate empty object struct', async () => {
			const schema = object({})
			const result = await schema.execute({})
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toEqual({})
			}
		})

		it('case 14: Validate object with transformed property schema', async () => {
			// Create a simple transformed schema for testing
			class SimpleTransformedSchema extends AbstractSchema<{ async: false, transformed: true, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

			implementSchemaClass(SimpleTransformedSchema, {
				isTransformed: () => true,
				execute: (value, { success }) => success(`${value} transformed`),
			})

			const transformedSchema = new SimpleTransformedSchema()
			const schema = object({ name: transformedSchema })
			const result = await schema.execute({ name: 'test' })
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toEqual({ name: 'test transformed' })
			}
		})
	})
})

describe('tests of `ObjectSchema`', () => {
	describe('happy path cases', () => {
		it('case 1: Instantiate and validate simple object', async () => {
			const schema = new ObjectSchema({ meta: { struct: { name: string() } } })
			const result = await schema.execute({ name: 'test' })
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toEqual({ name: 'test' })
			}
		})

		it('case 2: Instantiate and validate with transformations', async () => {
			class SimpleTransformedSchema extends AbstractSchema<{ async: false, transformed: true, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

			implementSchemaClass(SimpleTransformedSchema, {
				isTransformed: () => true,
				execute: (value, { success }) => success(`${value} transformed`),
			})

			const transformedSchema = new SimpleTransformedSchema()
			const schema = new ObjectSchema({ meta: { struct: { name: transformedSchema } } })
			const result = await schema.execute({ name: 'test' })
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toEqual({ name: 'test transformed' })
			}
		})
	})

	describe('edge cases', () => {
		it('case 1: Validate empty object struct', async () => {
			const schema = new ObjectSchema({ meta: { struct: {} } })
			const result = await schema.execute({})
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toEqual({})
			}
		})
	})
})
