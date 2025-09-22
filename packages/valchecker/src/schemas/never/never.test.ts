import { describe, expect, it } from 'vitest'
import { never, NeverSchema } from './never'

describe('tests for \`never.ts\`', () => {
	// Corresponds to \`NeverSchema\` section in the spec
	describe('\`NeverSchema\`', () => {
		describe('error cases', () => {
			// Test Case: [NeverSchema.error.1]
			it('should fail with any value', async () => {
				// Arrange
				const schema = new NeverSchema({})
				const input = 42
				const expected = { issues: [{ code: 'EXPECTED_NEVER', message: 'Expected never.' }] }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [NeverSchema.error.2]
			it('should fail with null', async () => {
				// Arrange
				const schema = new NeverSchema({})
				const input = null
				const expected = { issues: [{ code: 'EXPECTED_NEVER', message: 'Expected never.' }] }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [NeverSchema.error.3]
			it('should fail with undefined', async () => {
				// Arrange
				const schema = new NeverSchema({})
				const input = undefined
				const expected = { issues: [{ code: 'EXPECTED_NEVER', message: 'Expected never.' }] }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})
	})

	describe('\`never\`', () => {
		describe('happy path cases', () => {
			// Test Case: [never.happy.1]
			it('should create never schema without message', () => {
				// Arrange

				// Act
				const result = never()

				// Assert
				expect(result).toBeInstanceOf(NeverSchema)
			})

			// Test Case: [never.happy.2]
			it('should create never schema with message', () => {
				// Arrange
				const message = 'Custom message'

				// Act
				const result = never(message)

				// Assert
				expect(result).toBeInstanceOf(NeverSchema)
			})
		})
	})
})
