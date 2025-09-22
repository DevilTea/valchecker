import { describe, expect, it } from 'vitest'
import { null_, NullSchema } from './null'

// Specification: ./null.spec.md

describe('tests for `null.ts`', () => {
	// Corresponds to `NullSchema` section in the spec
	describe('`NullSchema`', () => {
		describe('happy path cases', () => {
			// Test Case: [NullSchema.happy.1]
			it('should succeed with null', async () => {
				// Arrange
				const schema = new NullSchema()
				const input = null
				const expected = { value: null }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})

		describe('error cases', () => {
			// Test Case: [NullSchema.error.1]
			it('should fail with non-null', async () => {
				// Arrange
				const schema = new NullSchema()
				const input = 42

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toHaveProperty('issues')
				expect((result as any).issues).toHaveLength(1)
				expect((result as any).issues[0].message).toBe('Expected null.')
			})
		})
	})

	describe('`null_`', () => {
		describe('happy path cases', () => {
			// Test Case: [null_.happy.1]
			it('should create null schema', () => {
				// Act
				const result = null_()

				// Assert
				expect(result).toBeInstanceOf(NullSchema)
			})
		})
	})
})
