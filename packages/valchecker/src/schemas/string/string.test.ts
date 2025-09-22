import { describe, expect, it } from 'vitest'
import { string, StringSchema } from './string'

// Specification: ./string.spec.md

describe('tests for `string.ts`', () => {
	// Corresponds to `StringSchema` section in the spec
	describe('`StringSchema`', () => {
		describe('happy path cases', () => {
			// Test Case: [StringSchema.happy.1]
			it('should succeed when value is a non-empty string', async () => {
				// Arrange
				const schema = string()
				const input = 'hello'
				const expected = { value: 'hello' }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [StringSchema.happy.2]
			it('should succeed when value is an empty string', async () => {
				// Arrange
				const schema = string()
				const input = ''
				const expected = { value: '' }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})

		describe('edge cases', () => {
			// Test Case: [StringSchema.edge.1]
			it('should succeed when value is an empty string', async () => {
				// Arrange
				const schema = string()
				const input = ''
				const expected = { value: '' }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})

		describe('error cases', () => {
			// Test Case: [StringSchema.error.1]
			it('should fail when value is a number', async () => {
				// Arrange
				const schema = string()
				const input = 123

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({
					issues: [
						{ code: 'EXPECTED_STRING', path: undefined, error: undefined, message: 'Expected string.' },
					],
				})
			})

			// Test Case: [StringSchema.error.2]
			it('should fail when value is a boolean', async () => {
				// Arrange
				const schema = string()
				const input = true

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({
					issues: [
						{ code: 'EXPECTED_STRING', path: undefined, error: undefined, message: 'Expected string.' },
					],
				})
			})

			// Test Case: [StringSchema.error.3]
			it('should fail when value is null', async () => {
				// Arrange
				const schema = string()
				const input = null

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({
					issues: [
						{ code: 'EXPECTED_STRING', path: undefined, error: undefined, message: 'Expected string.' },
					],
				})
			})

			// Test Case: [StringSchema.error.4]
			it('should fail when value is undefined', async () => {
				// Arrange
				const schema = string()
				const input = undefined

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({
					issues: [
						{ code: 'EXPECTED_STRING', path: undefined, error: undefined, message: 'Expected string.' },
					],
				})
			})

			// Test Case: [StringSchema.error.5]
			it('should fail when value is an object', async () => {
				// Arrange
				const schema = string()
				const input = {}

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({
					issues: [
						{ code: 'EXPECTED_STRING', path: undefined, error: undefined, message: 'Expected string.' },
					],
				})
			})
		})
	})

	describe('`string`', () => {
		describe('happy path cases', () => {
			// Test Case: [string.happy.1]
			it('should create a StringSchema without message', () => {
				// Arrange

				// Act
				const result = string()

				// Assert
				expect(result).toBeInstanceOf(StringSchema)
				expect(result.message).toBeUndefined()
			})

			// Test Case: [string.happy.2]
			it('should create a StringSchema with custom message', () => {
				// Arrange
				const customMessage = { EXPECTED_STRING: 'Custom message' }

				// Act
				const result = string(customMessage)

				// Assert
				expect(result).toBeInstanceOf(StringSchema)
			})
		})
	})
})
