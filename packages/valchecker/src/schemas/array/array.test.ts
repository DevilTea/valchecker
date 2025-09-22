import { describe, expect, it } from 'vitest'
import { number } from '../number'
import { pipe } from '../pipe/pipe'
import { array, ArraySchema } from './array'

describe('tests for \`array.ts\`', () => {
	// Corresponds to \`ArraySchema\` section in the spec
	describe('\`ArraySchema\`', () => {
		describe('happy path cases', () => {
			// Test Case: [ArraySchema.happy.1]
			it('should succeed with array of valid items', async () => {
				// Arrange
				const itemSchema = number()
				const schema = new ArraySchema({ meta: { item: itemSchema } })
				const input = [1, 2, 3]
				const expected = { value: [1, 2, 3] }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [ArraySchema.happy.2]
			it('should succeed with empty array', async () => {
				// Arrange
				const itemSchema = number()
				const schema = new ArraySchema({ meta: { item: itemSchema } })
				const input: number[] = []
				const expected = { value: [] }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [ArraySchema.happy.3]
			it('should succeed with array of transformed items', async () => {
				// Arrange
				const itemSchema = pipe(number()).transform(x => x * 2)
				const schema = new ArraySchema({ meta: { item: itemSchema } })
				const input = [1, 2, 3]
				const expected = { value: [2, 4, 6] }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})

		describe('edge cases', () => {
			// Test Case: [ArraySchema.edge.1]
			it('should fail with array containing invalid item', async () => {
				// Arrange
				const itemSchema = number()
				const schema = new ArraySchema({ meta: { item: itemSchema } })
				const input = [1, '2']
				const expected = { issues: [{ code: 'EXPECTED_NUMBER', message: 'Expected number.', path: [1] }] }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})

		describe('error cases', () => {
			// Test Case: [ArraySchema.error.1]
			it('should fail with string value', async () => {
				// Arrange
				const itemSchema = number()
				const schema = new ArraySchema({ meta: { item: itemSchema } })
				const input = 'array'
				const expected = { issues: [{ code: 'EXPECTED_ARRAY', message: 'Expected an array.' }] }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [ArraySchema.error.2]
			it('should fail with object value', async () => {
				// Arrange
				const itemSchema = number()
				const schema = new ArraySchema({ meta: { item: itemSchema } })
				const input = {}
				const expected = { issues: [{ code: 'EXPECTED_ARRAY', message: 'Expected an array.' }] }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [ArraySchema.error.3]
			it('should fail with null value', async () => {
				// Arrange
				const itemSchema = number()
				const schema = new ArraySchema({ meta: { item: itemSchema } })
				const input = null
				const expected = { issues: [{ code: 'EXPECTED_ARRAY', message: 'Expected an array.' }] }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})
	})

	describe('\`array\`', () => {
		describe('happy path cases', () => {
			// Test Case: [array.happy.1]
			it('should create array schema with item schema', () => {
				// Arrange
				const itemSchema = number()
				const expected = new ArraySchema({ meta: { item: itemSchema } })

				// Act
				const result = array(itemSchema)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [array.happy.2]
			it('should create array schema with message', () => {
				// Arrange
				const itemSchema = number()
				const message = 'Custom message'
				const expected = new ArraySchema({ meta: { item: itemSchema }, message })

				// Act
				const result = array(itemSchema, message)

				// Assert
				expect(result).toEqual(expected)
			})
		})
	})
})
