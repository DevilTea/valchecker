import { describe, expect, it } from 'vitest'
import { unknown, UnknownSchema } from './unknown'

// Specification: ./unknown.spec.md

describe('tests for `unknown.ts`', () => {
	// Corresponds to `UnknownSchema` section in the spec
	describe('`UnknownSchema`', () => {
		describe('happy path cases', () => {
			// Test Case: [UnknownSchema.happy.1]
			it('should succeed when value is a string', async () => {
				// Arrange
				const schema = unknown()
				const input = 'test'
				const expected = { value: 'test' }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [UnknownSchema.happy.2]
			it('should succeed when value is a number', async () => {
				// Arrange
				const schema = unknown()
				const input = 123
				const expected = { value: 123 }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [UnknownSchema.happy.3]
			it('should succeed when value is null', async () => {
				// Arrange
				const schema = unknown()
				const input = null
				const expected = { value: null }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [UnknownSchema.happy.4]
			it('should succeed when value is an object', async () => {
				// Arrange
				const schema = unknown()
				const input = {}
				const expected = { value: {} }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})
	})

	describe('`unknown`', () => {
		describe('happy path cases', () => {
			// Test Case: [unknown.happy.1]
			it('should create an UnknownSchema', () => {
				// Arrange

				// Act
				const result = unknown()

				// Assert
				expect(result).toBeInstanceOf(UnknownSchema)
			})
		})
	})
})
