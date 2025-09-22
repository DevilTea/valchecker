import { describe, expect, it } from 'vitest'
import { number } from '../../index'
import { optional, OptionalSchema, unwrapOptional } from './optional'

// Specification: ./optional.spec.md

describe('tests for `optional.ts`', () => {
	// Corresponds to `OptionalSchema` section in the spec
	describe('`OptionalSchema`', () => {
		describe('happy path cases', () => {
			// Test Case: [OptionalSchema.happy.1]
			it('should succeed with undefined input', async () => {
				// Arrange
				const schema = new OptionalSchema({ meta: { schema: number() } })
				const input = undefined
				const expected = { value: undefined }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [OptionalSchema.happy.2]
			it('should succeed with valid input', async () => {
				// Arrange
				const schema = new OptionalSchema({ meta: { schema: number() } })
				const input = 42
				const expected = { value: 42 }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})

		describe('error cases', () => {
			// Test Case: [OptionalSchema.error.1]
			it('should fail with invalid input', async () => {
				// Arrange
				const schema = new OptionalSchema({ meta: { schema: number() } })
				const input = '42'

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toHaveProperty('issues')
				expect((result as any).issues).toHaveLength(1)
				expect((result as any).issues[0].message).toBe('Expected number.')
			})
		})
	})

	describe('`optional`', () => {
		describe('happy path cases', () => {
			// Test Case: [optional.happy.1]
			it('should create optional schema', () => {
				// Arrange
				const innerSchema = number()

				// Act
				const result = optional(innerSchema)

				// Assert
				expect(result).toBeInstanceOf(OptionalSchema)
				expect(result.meta.schema).toBe(innerSchema)
			})
		})
	})

	describe('`unwrapOptional`', () => {
		describe('happy path cases', () => {
			// Test Case: [unwrapOptional.happy.1]
			it('should unwrap optional schema', () => {
				// Arrange
				const innerSchema = number()
				const optSchema = optional(innerSchema)

				// Act
				const result = unwrapOptional(optSchema)

				// Assert
				expect(result).toBe(innerSchema)
			})

			// Test Case: [unwrapOptional.happy.2]
			it('should return non-optional schema as is', () => {
				// Arrange
				const schema = number()

				// Act
				const result = unwrapOptional(schema)

				// Assert
				expect(result).toBe(schema)
			})
		})
	})
})
