import { describe, expect, it } from 'vitest'
import { literal, LiteralSchema } from './literal'

// Specification: ./literal.spec.md

describe('tests for `literal.ts`', () => {
	// Corresponds to `literal` section in the spec
	describe('`literal`', () => {
		describe('happy path cases', () => {
			// Test Case: [literal.happy.1]
			it('should create literal schema', () => {
				// Arrange
				const value = 'test'

				// Act
				const schema = literal(value)

				// Assert
				expect(schema).toBeInstanceOf(LiteralSchema)
				expect(schema.meta.value).toBe('test')
			})
		})
	})

	// Corresponds to `LiteralSchema` section in the spec
	describe('`LiteralSchema`', () => {
		describe('happy path cases', () => {
			// Test Case: [LiteralSchema.happy.1]
			it('should execute with matching string value', async () => {
				// Arrange
				const schema = new LiteralSchema({ meta: { value: 'test' } })
				const input = 'test'

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ value: 'test' })
			})

			// Test Case: [LiteralSchema.happy.2]
			it('should execute with matching number value', async () => {
				// Arrange
				const schema = new LiteralSchema({ meta: { value: 42 } })
				const input = 42

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ value: 42 })
			})

			// Test Case: [LiteralSchema.happy.3]
			it('should execute with matching boolean value', async () => {
				// Arrange
				const schema = new LiteralSchema({ meta: { value: true } })
				const input = true

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ value: true })
			})

			// Test Case: [LiteralSchema.happy.4]
			it('should execute with NaN value, input NaN', async () => {
				// Arrange
				const schema = new LiteralSchema({ meta: { value: Number.NaN } })
				const input = Number.NaN

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ value: Number.NaN })
			})
		})

		describe('edge cases', () => {
			// Test Case: [LiteralSchema.edge.1]
			it('should execute with NaN value, input not NaN', async () => {
				// Arrange
				const schema = new LiteralSchema({ meta: { value: Number.NaN } })
				const input = 42

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ issues: [{ code: 'INVALID_LITERAL', message: 'Invalid value.' }] })
			})
		})

		describe('error cases', () => {
			// Test Case: [LiteralSchema.error.1]
			it('should execute with non-matching value', async () => {
				// Arrange
				const schema = new LiteralSchema({ meta: { value: 'test' } })
				const input = 'other'

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ issues: [{ code: 'INVALID_LITERAL', message: 'Invalid value.' }] })
			})
		})
	})
})
