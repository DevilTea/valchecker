import { describe, expect, it } from 'vitest'
import { boolean, BooleanSchema } from './boolean'

// Specification: ./boolean.spec.md

describe('tests for `boolean.ts`', () => {
	// Corresponds to `boolean` section in the spec
	describe('`boolean`', () => {
		describe('happy path cases', () => {
			// Test Case: [boolean.happy.1]
			it('should create boolean schema', () => {
				// Arrange

				// Act
				const schema = boolean()

				// Assert
				expect(schema).toBeInstanceOf(BooleanSchema)
			})
		})
	})

	// Corresponds to `BooleanSchema` section in the spec
	describe('`BooleanSchema`', () => {
		describe('happy path cases', () => {
			// Test Case: [BooleanSchema.happy.1]
			it('should execute with true value', async () => {
				// Arrange
				const schema = new BooleanSchema({})
				const input = true

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ value: true })
			})

			// Test Case: [BooleanSchema.happy.2]
			it('should execute with false value', async () => {
				// Arrange
				const schema = new BooleanSchema({})
				const input = false

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ value: false })
			})
		})

		describe('error cases', () => {
			// Test Case: [BooleanSchema.error.1]
			it('should execute with number value', async () => {
				// Arrange
				const schema = new BooleanSchema({})
				const input = 1

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ issues: [{ code: 'EXPECTED_BOOLEAN', message: 'Expected boolean.' }] })
			})

			// Test Case: [BooleanSchema.error.2]
			it('should execute with string value', async () => {
				// Arrange
				const schema = new BooleanSchema({})
				const input = 'true'

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ issues: [{ code: 'EXPECTED_BOOLEAN', message: 'Expected boolean.' }] })
			})

			// Test Case: [BooleanSchema.error.3]
			it('should execute with null value', async () => {
				// Arrange
				const schema = new BooleanSchema({})
				const input = null

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ issues: [{ code: 'EXPECTED_BOOLEAN', message: 'Expected boolean.' }] })
			})

			// Test Case: [BooleanSchema.error.4]
			it('should execute with undefined value', async () => {
				// Arrange
				const schema = new BooleanSchema({})
				const input = undefined

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ issues: [{ code: 'EXPECTED_BOOLEAN', message: 'Expected boolean.' }] })
			})

			// Test Case: [BooleanSchema.error.5]
			it('should execute with object value', async () => {
				// Arrange
				const schema = new BooleanSchema({})
				const input = {}

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ issues: [{ code: 'EXPECTED_BOOLEAN', message: 'Expected boolean.' }] })
			})
		})
	})
})
