import { describe, expect, it } from 'vitest'
import { any, AnySchema } from './any'

// Specification: ./any.spec.md

describe('tests for `any.ts`', () => {
	// Corresponds to `AnySchema` section in the spec
	describe('`AnySchema`', () => {
		describe('happy path cases', () => {
			// Test Case: [AnySchema.happy.1]
			it('should succeed with any input', async () => {
				// Arrange
				const schema = new AnySchema()
				const input = 42
				const expected = { value: 42 }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [AnySchema.happy.2]
			it('should succeed with another input', async () => {
				// Arrange
				const schema = new AnySchema()
				const input = 'hello'
				const expected = { value: 'hello' }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})
	})

	describe('`any`', () => {
		describe('happy path cases', () => {
			// Test Case: [any.happy.1]
			it('should create any schema', () => {
				// Act
				const result = any()

				// Assert
				expect(result).toBeInstanceOf(AnySchema)
			})
		})
	})
})
