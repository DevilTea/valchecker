import { describe, expect, it } from 'vitest'
import { bigint, BigintSchema } from './bigint'

// Specification: ./bigint.spec.md

describe('tests for `bigint.ts`', () => {
	// Corresponds to `bigint` section in the spec
	describe('`bigint`', () => {
		describe('happy path cases', () => {
			// Test Case: [bigint.happy.1]
			it('should create bigint schema', () => {
				// Arrange

				// Act
				const schema = bigint()

				// Assert
				expect(schema).toBeInstanceOf(BigintSchema)
			})
		})
	})

	// Corresponds to `BigintSchema` section in the spec
	describe('`BigintSchema`', () => {
		describe('happy path cases', () => {
			// Test Case: [BigintSchema.happy.1]
			it('should execute with bigint value', async () => {
				// Arrange
				const schema = new BigintSchema({})
				const input = 42n

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ value: 42n })
			})
		})

		describe('error cases', () => {
			// Test Case: [BigintSchema.error.1]
			it('should execute with number value', async () => {
				// Arrange
				const schema = new BigintSchema({})
				const input = 42

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ issues: [{ code: 'EXPECTED_BIGINT', message: 'Expected bigint.' }] })
			})

			// Test Case: [BigintSchema.error.2]
			it('should execute with string value', async () => {
				// Arrange
				const schema = new BigintSchema({})
				const input = '42'

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ issues: [{ code: 'EXPECTED_BIGINT', message: 'Expected bigint.' }] })
			})

			// Test Case: [BigintSchema.error.3]
			it('should execute with boolean value', async () => {
				// Arrange
				const schema = new BigintSchema({})
				const input = true

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ issues: [{ code: 'EXPECTED_BIGINT', message: 'Expected bigint.' }] })
			})

			// Test Case: [BigintSchema.error.4]
			it('should execute with null value', async () => {
				// Arrange
				const schema = new BigintSchema({})
				const input = null

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ issues: [{ code: 'EXPECTED_BIGINT', message: 'Expected bigint.' }] })
			})

			// Test Case: [BigintSchema.error.5]
			it('should execute with undefined value', async () => {
				// Arrange
				const schema = new BigintSchema({})
				const input = undefined

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ issues: [{ code: 'EXPECTED_BIGINT', message: 'Expected bigint.' }] })
			})
		})
	})
})
