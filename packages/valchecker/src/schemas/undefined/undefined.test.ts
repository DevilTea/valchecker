import { describe, expect, it } from 'vitest'
import { undefined_, UndefinedSchema } from './undefined'

// Specification: ./undefined.spec.md

describe('tests for `undefined.ts`', () => {
	// Corresponds to `UndefinedSchema` section in the spec
	describe('`UndefinedSchema`', () => {
		describe('happy path cases', () => {
			// Test Case: [UndefinedSchema.happy.1]
			it('should succeed with undefined', async () => {
				// Arrange
				const schema = new UndefinedSchema()
				const input = undefined
				const expected = { value: undefined }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})

		describe('error cases', () => {
			// Test Case: [UndefinedSchema.error.1]
			it('should fail with non-undefined', async () => {
				// Arrange
				const schema = new UndefinedSchema()
				const input = 42

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toHaveProperty('issues')
				expect((result as any).issues).toHaveLength(1)
				expect((result as any).issues[0].message).toBe('Expected undefined.')
			})
		})
	})

	describe('`undefined_`', () => {
		describe('happy path cases', () => {
			// Test Case: [undefined_.happy.1]
			it('should create undefined schema', () => {
				// Act
				const result = undefined_()

				// Assert
				expect(result).toBeInstanceOf(UndefinedSchema)
			})
		})
	})
})
