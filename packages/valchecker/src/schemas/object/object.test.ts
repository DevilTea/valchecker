import { describe, expect, it } from 'vitest'
import { number, pipe, string } from '../../index'
import { object, ObjectSchema } from './object'

// Specification: ./object.spec.md

describe('tests for `object.ts`', () => {
	// Corresponds to `ObjectSchema` section in the spec
	describe('`ObjectSchema`', () => {
		describe('happy path cases', () => {
			// Test Case: [ObjectSchema.happy.1]
			it('should succeed with valid object', async () => {
				// Arrange
				const schema = new ObjectSchema({ meta: { struct: { a: number(), b: string() } } })
				const input = { a: 1, b: 'hello' }
				const expected = { value: { a: 1, b: 'hello' } }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})

		describe('error cases', () => {
			// Test Case: [ObjectSchema.error.1]
			it('should fail with non-object', async () => {
				// Arrange
				const schema = new ObjectSchema({ meta: { struct: { a: number() } } })
				const input = 42

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toHaveProperty('issues')
				expect((result as any).issues).toHaveLength(1)
				expect((result as any).issues[0].message).toBe('Expected an object.')
			})

			it('should fail with null', async () => {
				// Arrange
				const schema = new ObjectSchema({ meta: { struct: { a: number() } } })
				const input = null

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toHaveProperty('issues')
				expect((result as any).issues).toHaveLength(1)
				expect((result as any).issues[0].message).toBe('Expected an object.')
			})

			it('should fail with array', async () => {
				// Arrange
				const schema = new ObjectSchema({ meta: { struct: { a: number() } } })
				const input = [1]

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toHaveProperty('issues')
				expect((result as any).issues).toHaveLength(1)
				expect((result as any).issues[0].message).toBe('Expected an object.')
			})

			// Test Case: [ObjectSchema.error.2]
			it('should fail with invalid property', async () => {
				// Arrange
				const schema = new ObjectSchema({ meta: { struct: { a: number() } } })
				const input = { a: '1' }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toHaveProperty('issues')
				expect((result as any).issues).toHaveLength(1)
				expect((result as any).issues[0].message).toBe('Expected number.')
				expect((result as any).issues[0].path).toEqual(['a'])
			})
		})
	})

	describe('`object`', () => {
		describe('happy path cases', () => {
			// Test Case: [object.happy.1]
			it('should create object schema', () => {
				// Arrange
				const struct = { a: number() }

				// Act
				const result = object(struct)

				// Assert
				expect(result).toBeInstanceOf(ObjectSchema)
				expect(result.meta.struct).toBe(struct)
			})

			it('should handle transformed schemas', async () => {
				// Arrange
				const transformSchema = pipe(number()).transform((value: number) => value * 2)
				const schema = new ObjectSchema({ meta: { struct: { a: transformSchema } } })
				const input = { a: 5 }
				const expected = { value: { a: 10 } }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})
	})
})
