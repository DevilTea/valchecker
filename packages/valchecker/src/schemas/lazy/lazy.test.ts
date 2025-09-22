import { describe, expect, it } from 'vitest'
import { number } from '../../index'
import { lazy, LazySchema } from './lazy'

// Specification: ./lazy.spec.md

describe('tests for `lazy.ts`', () => {
	// Corresponds to `LazySchema` section in the spec
	describe('`LazySchema`', () => {
		describe('happy path cases', () => {
			// Test Case: [LazySchema.happy.1]
			it('should succeed with valid input for lazy schema', async () => {
				// Arrange
				const schema = new LazySchema({ meta: { getSchema: () => number() } })
				const input = 42
				const expected = { value: 42 }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})

		describe('error cases', () => {
			// Test Case: [LazySchema.error.1]
			it('should fail with invalid input for lazy schema', async () => {
				// Arrange
				const schema = new LazySchema({ meta: { getSchema: () => number() } })
				const input = '42'

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toHaveProperty('issues')
				expect((result as any).issues).toHaveLength(1)
				expect((result as any).issues[0].message).toBe('Expected number.')
			})
		})
	})

	describe('`lazy`', () => {
		describe('happy path cases', () => {
			// Test Case: [lazy.happy.1]
			it('should create lazy schema', () => {
				// Arrange
				const getSchema = () => number()

				// Act
				const result = lazy(getSchema)

				// Assert
				expect(result).toBeInstanceOf(LazySchema)
				expect(result.meta.getSchema).toBe(getSchema)
			})
		})
	})
})
