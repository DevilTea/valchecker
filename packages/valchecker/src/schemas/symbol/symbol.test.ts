import { describe, expect, it } from 'vitest'
import { symbol, SymbolSchema } from './symbol'

describe('tests for \`symbol.ts\`', () => {
	// Corresponds to \`SymbolSchema\` section in the spec
	describe('\`SymbolSchema\`', () => {
		describe('happy path cases', () => {
			// Test Case: [SymbolSchema.happy.1]
			it('should succeed with symbol value', async () => {
				// Arrange
				const schema = new SymbolSchema({})
				const input = Symbol('test')
				const expected = { value: input }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})

		describe('error cases', () => {
			// Test Case: [SymbolSchema.error.1]
			it('should fail with string value', async () => {
				// Arrange
				const schema = new SymbolSchema({})
				const input = 'symbol'
				const expected = { issues: [{ code: 'EXPECTED_SYMBOL', message: 'Expected symbol.' }] }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [SymbolSchema.error.2]
			it('should fail with number value', async () => {
				// Arrange
				const schema = new SymbolSchema({})
				const input = 42
				const expected = { issues: [{ code: 'EXPECTED_SYMBOL', message: 'Expected symbol.' }] }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [SymbolSchema.error.3]
			it('should fail with null value', async () => {
				// Arrange
				const schema = new SymbolSchema({})
				const input = null
				const expected = { issues: [{ code: 'EXPECTED_SYMBOL', message: 'Expected symbol.' }] }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [SymbolSchema.error.4]
			it('should fail with undefined value', async () => {
				// Arrange
				const schema = new SymbolSchema({})
				const input = undefined
				const expected = { issues: [{ code: 'EXPECTED_SYMBOL', message: 'Expected symbol.' }] }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [SymbolSchema.error.5]
			it('should fail with object value', async () => {
				// Arrange
				const schema = new SymbolSchema({})
				const input = {}
				const expected = { issues: [{ code: 'EXPECTED_SYMBOL', message: 'Expected symbol.' }] }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})
	})

	describe('\`symbol\`', () => {
		describe('happy path cases', () => {
			// Test Case: [symbol.happy.1]
			it('should create symbol schema without message', () => {
				// Arrange

				// Act
				const result = symbol()

				// Assert
				expect(result).toBeInstanceOf(SymbolSchema)
			})

			// Test Case: [symbol.happy.2]
			it('should create symbol schema with message', () => {
				// Arrange
				const message = 'Custom message'

				// Act
				const result = symbol(message)

				// Assert
				expect(result).toBeInstanceOf(SymbolSchema)
			})
		})
	})
})
