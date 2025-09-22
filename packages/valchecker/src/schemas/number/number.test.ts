import { describe, expect, it } from 'vitest'
import { number, NumberSchema } from './number'

// Specification: ./number.spec.md

describe('tests for \`number.ts\`', () => {
	// Corresponds to \`NumberSchema\` section in the spec
	describe('\`NumberSchema\`', () => {
		describe('happy path cases', () => {
			// Test Case: [NumberSchema.happy.1]
			it('should succeed with number value when allowNaN is false', async () => {
				// Arrange
				const schema = new NumberSchema({ meta: { allowNaN: false } })
				const input = 42
				const expected = { value: 42 }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [NumberSchema.happy.2]
			it('should succeed with NaN value when allowNaN is true', async () => {
				// Arrange
				const schema = new NumberSchema({ meta: { allowNaN: true } })
				const input = Number.NaN
				const expected = { value: Number.NaN }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})

		describe('edge cases', () => {
			// Test Case: [NumberSchema.edge.1]
			it('should fail with NaN value when allowNaN is false', async () => {
				// Arrange
				const schema = new NumberSchema({ meta: { allowNaN: false } })
				const input = Number.NaN
				const expected = { issues: [{ code: 'EXPECTED_NUMBER', message: 'Expected number.' }] }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})

		describe('error cases', () => {
			// Test Case: [NumberSchema.error.1]
			it('should fail with string value', async () => {
				// Arrange
				const schema = new NumberSchema({ meta: { allowNaN: false } })
				const input = '42'
				const expected = { issues: [{ code: 'EXPECTED_NUMBER', message: 'Expected number.' }] }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [NumberSchema.error.2]
			it('should fail with boolean value', async () => {
				// Arrange
				const schema = new NumberSchema({ meta: { allowNaN: false } })
				const input = true
				const expected = { issues: [{ code: 'EXPECTED_NUMBER', message: 'Expected number.' }] }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [NumberSchema.error.3]
			it('should fail with null value', async () => {
				// Arrange
				const schema = new NumberSchema({ meta: { allowNaN: false } })
				const input = null
				const expected = { issues: [{ code: 'EXPECTED_NUMBER', message: 'Expected number.' }] }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [NumberSchema.error.4]
			it('should fail with undefined value', async () => {
				// Arrange
				const schema = new NumberSchema({ meta: { allowNaN: false } })
				const input = undefined
				const expected = { issues: [{ code: 'EXPECTED_NUMBER', message: 'Expected number.' }] }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [NumberSchema.error.5]
			it('should fail with object value', async () => {
				// Arrange
				const schema = new NumberSchema({ meta: { allowNaN: false } })
				const input = {}
				const expected = { issues: [{ code: 'EXPECTED_NUMBER', message: 'Expected number.' }] }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})
	})

	describe('\`number\`', () => {
		describe('happy path cases', () => {
			// Test Case: [number.happy.1]
			it('should create number schema without allowNaN', () => {
				// Arrange
				const expected = new NumberSchema({ meta: { allowNaN: false } })

				// Act
				const result = number()

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [number.happy.2]
			it('should create number schema with allowNaN true', () => {
				// Arrange
				const expected = new NumberSchema({ meta: { allowNaN: true } })

				// Act
				const result = number(true)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [number.happy.3]
			it('should create number schema with message', () => {
				// Arrange
				const message = 'Custom message'
				const expected = new NumberSchema({ meta: { allowNaN: false }, message })

				// Act
				const result = number(message)

				// Assert
				expect(result).toEqual(expected)
			})
		})
	})
})
