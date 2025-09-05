import { describe, expect, it } from 'vitest'
import { AbstractSchema, implementSchemaClass, isSuccessResult } from '../../core'
import { number } from '../number'
import { string } from '../string'
import { object, ObjectSchema } from './object'

describe('tests of `object`', () => {
	describe('happy path cases', () => {
		it('case 1: Create object schema', () => {
			const schema = object({ name: string() })
			expect(schema).toBeInstanceOf(ObjectSchema)
		})
	})

	describe('edge cases', () => {
		it('case 1: Validate object with valid properties', async () => {
			const schema = object({ name: string() })
			const result = await schema.validate({ name: 'John' })
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toEqual({ name: 'John' })
			}
		})

		it('case 2: Validate object with invalid properties', async () => {
			const schema = object({ name: string() })
			const result = await schema.validate({ name: 123 })
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(1)
				expect(result.issues[0]!.message).toBe('Expected string.')
				expect(result.issues[0]!.path).toEqual(['name'])
			}
		})

		it('case 3: Validate object with missing properties', async () => {
			const schema = object({ name: string() })
			const result = await schema.validate({})
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(1)
				expect(result.issues[0]!.message).toBe('Expected string.')
				expect(result.issues[0]!.path).toEqual(['name'])
			}
		})

		it('case 4: Validate object with extra properties', async () => {
			const schema = object({ name: string() })
			const result = await schema.validate({ name: 'John', age: 30 })
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toEqual({ name: 'John', age: 30 })
			}
		})

		it('case 5: Validate non-object value', async () => {
			const schema = object({ name: string() })
			const result = await schema.validate('not an object')
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(1)
				expect(result.issues[0]!.message).toBe('Expected an object.')
			}
		})

		it('case 6: Validate null value', async () => {
			const schema = object({ name: string() })
			const result = await schema.validate(null)
			expect(isSuccessResult(result)).toBe(false)
			if (!isSuccessResult(result)) {
				expect(result.issues).toHaveLength(1)
				expect(result.issues[0]!.message).toBe('Expected an object.')
			}
		})

		it('case 7: Validate array value', async () => {
			const schema = object({ name: string() })
			const result = await schema.validate([])
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
			const result = await schema.validate({
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

		it('case 9: Validate object with transformed property schema', async () => {
			// Create a simple transformed schema for testing
			class SimpleTransformedSchema extends AbstractSchema<{ async: false, transformed: true, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

			implementSchemaClass(SimpleTransformedSchema, {
				isTransformed: () => true,
				validate: (value, { success }) => success(`${value} transformed`),
			})

			const transformedSchema = new SimpleTransformedSchema()
			const schema = object({ name: transformedSchema })
			const result = await schema.validate({ name: 'test' })
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toEqual({ name: 'test transformed' })
			}
		})
	})
})

describe('tests of `ObjectSchema`', () => {
	describe('happy path cases', () => {
		it('case 1: Instantiate and validate', async () => {
			const schema = new ObjectSchema({ meta: { struct: { name: string() } } })
			const result = await schema.validate({ name: 'test' })
			expect(isSuccessResult(result)).toBe(true)
			if (isSuccessResult(result)) {
				expect(result.value).toEqual({ name: 'test' })
			}
		})
	})
})
