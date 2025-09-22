import { describe, expect, it } from 'vitest'
import { number, optional, pipe, string } from '../../index'
import { looseObject, object, ObjectSchema, strictObject } from './object'

// Specification: ./object.spec.md

describe('tests for `object.ts`', () => {
	// Corresponds to `object` section in the spec
	describe('`object`', () => {
		describe('happy path cases', () => {
			// Test Case: [object.happy.1]
			it('should create and execute with valid object matching struct', async () => {
				// Arrange
				const schema = object({ a: number(), b: string() })
				const input = { a: 1, b: 'test' }
				const expected = { value: { a: 1, b: 'test' } }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [object.happy.2]
			it('should create and execute with extra keys allowed', async () => {
				// Arrange
				const schema = object({ a: number() })
				const input = { a: 1, b: 'extra' }
				const expected = { value: { a: 1 } }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [object.happy.3]
			it('should create with optional properties', async () => {
				// Arrange
				const schema = object({ a: optional(number()) })
				const input = {}
				const expected = { value: {} }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})

		describe('edge cases', () => {
			// Test Case: [object.edge.1]
			it('should fail with null value', async () => {
				// Arrange
				const schema = object({ a: number() })
				const input = null

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toHaveProperty('issues')
				expect((result as any).issues).toHaveLength(1)
				expect((result as any).issues[0].message).toBe('Expected an object.')
			})

			// Test Case: [object.edge.2]
			it('should fail with array value', async () => {
				// Arrange
				const schema = object({ a: number() })
				const input: any = []

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toHaveProperty('issues')
				expect((result as any).issues).toHaveLength(1)
				expect((result as any).issues[0].message).toBe('Expected an object.')
			})
		})

		describe('error cases', () => {
			// Test Case: [object.error.1]
			it('should fail with invalid property type', async () => {
				// Arrange
				const schema = object({ a: number() })
				const input = { a: 'invalid' }

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

	// Corresponds to `looseObject` section in the spec
	describe('`looseObject`', () => {
		describe('happy path cases', () => {
			// Test Case: [looseObject.happy.1]
			it('should create and execute with valid object, preserving extra keys', async () => {
				// Arrange
				const schema = looseObject({ a: number() })
				const input = { a: 1, b: 'extra' }
				const expected = { value: { a: 1, b: 'extra' } }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [looseObject.happy.2]
			it('should create and execute with transformed schema', async () => {
				// Arrange
				const transformSchema = pipe(number()).transform((value: number) => value * 2)
				const schema = looseObject({ a: transformSchema })
				const input = { a: 5, b: 'extra' }
				const expected = { value: { a: 10, b: 'extra' } }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})

		describe('edge cases', () => {
			// Test Case: [looseObject.edge.1]
			it('should execute with no extra keys', async () => {
				// Arrange
				const schema = looseObject({ a: number() })
				const input = { a: 1 }
				const expected = { value: { a: 1 } }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})

		describe('error cases', () => {
			// Test Case: [looseObject.error.1]
			it('should fail with invalid property', async () => {
				// Arrange
				const schema = looseObject({ a: number() })
				const input = { a: 'invalid', b: 'extra' }

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

	// Corresponds to `ObjectSchema` section in the spec
	describe('`ObjectSchema`', () => {
		describe('happy path cases', () => {
			// Test Case: [ObjectSchema.happy.1]
			it('should instantiate and execute default mode', async () => {
				// Arrange
				const schema = new ObjectSchema({ meta: { struct: { a: number() }, mode: 'default' } })
				const input = { a: 1 }
				const expected = { value: { a: 1 } }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [ObjectSchema.happy.2]
			it('should instantiate and execute loose mode', async () => {
				// Arrange
				const schema = new ObjectSchema({ meta: { struct: { a: number() }, mode: 'loose' } })
				const input = { a: 1, b: 'extra' }
				const expected = { value: { a: 1, b: 'extra' } }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [ObjectSchema.happy.3]
			it('should instantiate and execute strict mode', async () => {
				// Arrange
				const schema = new ObjectSchema({ meta: { struct: { a: number(), b: string() }, mode: 'strict' } })
				const input = { a: 1, b: 'test' }
				const expected = { value: { a: 1, b: 'test' } }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})

		describe('error cases', () => {
			// Test Case: [ObjectSchema.error.1]
			it('should fail strict mode with extra key', async () => {
				// Arrange
				const schema = new ObjectSchema({ meta: { struct: { a: number() }, mode: 'strict' } })
				const input = { a: 1, b: 'extra' }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toHaveProperty('issues')
				expect((result as any).issues).toHaveLength(1)
				expect((result as any).issues[0].message).toBe('Key is not expected.')
			})
		})
	})

	// Corresponds to `strictObject` section in the spec
	describe('`strictObject`', () => {
		describe('happy path cases', () => {
			// Test Case: [strictObject.happy.1]
			it('should create and execute with exact struct match', async () => {
				// Arrange
				const schema = strictObject({ a: number(), b: string() })
				const input = { a: 1, b: 'test' }
				const expected = { value: { a: 1, b: 'test' } }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})

		describe('edge cases', () => {
			// Test Case: [strictObject.edge.1]
			it('should fail with missing required property', async () => {
				// Arrange
				const schema = strictObject({ a: number() })
				const input = {}

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toHaveProperty('issues')
				expect((result as any).issues).toHaveLength(1)
				expect((result as any).issues[0].message).toBe('Expected number.')
				expect((result as any).issues[0].path).toEqual(['a'])
			})
		})

		describe('error cases', () => {
			// Test Case: [strictObject.error.1]
			it('should fail with extra key', async () => {
				// Arrange
				const schema = strictObject({ a: number() })
				const input = { a: 1, b: 'extra' }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toHaveProperty('issues')
				expect((result as any).issues).toHaveLength(1)
				expect((result as any).issues[0].message).toBe('Key is not expected.')
			})

			// Test Case: [strictObject.error.2]
			it('should fail with invalid type', async () => {
				// Arrange
				const schema = strictObject({ a: number() })
				const input = { a: 'invalid' }

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
})
