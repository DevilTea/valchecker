import { describe, expect, it } from 'vitest'
import { number, string } from '../index'
import { union, UnionSchema } from './union'

// Specification: ./union.spec.md

describe('tests for `union.ts`', () => {
	// Corresponds to `UnionSchema` section in the spec
	describe('`UnionSchema`', () => {
		describe('happy path cases', () => {
			// Test Case: [UnionSchema.happy.1]
			it('should succeed when value passes the first branch', async () => {
				// Arrange
				const schema = union(string(), number())
				const input = 'test'
				const expected = { value: 'test' }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [UnionSchema.happy.2]
			it('should succeed when value passes a middle branch', async () => {
				// Arrange
				const schema = union(number(), string(), number())
				const input = 'test'
				const expected = { value: 'test' }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})

			// Test Case: [UnionSchema.happy.3]
			it('should succeed when value passes the last branch', async () => {
				// Arrange
				const schema = union(number(), string())
				const input = 'test'
				const expected = { value: 'test' }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})

		describe('edge cases', () => {
			// Test Case: [UnionSchema.edge.1]
			it('should fail when no branches provided', async () => {
				// Arrange
				const schema = new UnionSchema({ meta: { branches: [] } })
				const input = 'test'

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ issues: [] })
			})
		})

		describe('error cases', () => {
			// Test Case: [UnionSchema.error.1]
			it('should fail when value fails all branches', async () => {
				// Arrange
				const schema = union(number(), string())
				const input = true

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({
					issues: [
						{ code: 'EXPECTED_NUMBER', path: undefined, error: undefined, message: 'Expected number.' },
						{ code: 'EXPECTED_STRING', path: undefined, error: undefined, message: 'Expected string.' },
					],
				})
			})
		})
	})

	describe('`union`', () => {
		describe('happy path cases', () => {
			// Test Case: [union.happy.1]
			it('should create a UnionSchema with two branches', () => {
				// Arrange
				const branch1 = string()
				const branch2 = number()

				// Act
				const result = union(branch1, branch2)

				// Assert
				expect(result).toBeInstanceOf(UnionSchema)
				expect(result.meta.branches).toEqual([branch1, branch2])
			})
		})
	})
})
