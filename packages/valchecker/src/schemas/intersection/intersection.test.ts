import { describe, expect, it } from 'vitest'
import { literal, number, string } from '../../index'
import { intersection, IntersectionSchema } from './intersection'

// Specification: ./intersection.spec.md

describe('tests for `intersection.ts`', () => {
	// Corresponds to `IntersectionSchema` section in the spec
	describe('`IntersectionSchema`', () => {
		describe('happy path cases', () => {
			// Test Case: [IntersectionSchema.happy.1]
			it('should succeed when value satisfies all branches', async () => {
				// Arrange
				const schema = new IntersectionSchema({ meta: { branches: [number(), literal(42)] } })
				const input = 42
				const expected = { value: 42 }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})

		describe('error cases', () => {
			// Test Case: [IntersectionSchema.error.1]
			it('should fail when value fails one branch', async () => {
				// Arrange
				const schema = new IntersectionSchema({ meta: { branches: [string(), number()] } })
				const input = '42'

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toHaveProperty('issues')
				expect((result as any).issues).toHaveLength(1)
				expect((result as any).issues[0].message).toBe('Expected number.')
			})

			// Test Case: [IntersectionSchema.error.2]
			it('should fail when value fails all branches', async () => {
				// Arrange
				const schema = new IntersectionSchema({ meta: { branches: [string(), number()] } })
				const input = {}

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toHaveProperty('issues')
				expect((result as any).issues).toHaveLength(1)
				expect((result as any).issues[0].message).toBe('Expected string.')
			})
		})
	})

	describe('`intersection`', () => {
		describe('happy path cases', () => {
			// Test Case: [intersection.happy.1]
			it('should create intersection schema with branches', () => {
				// Arrange
				const branch1 = number()
				const branch2 = string()

				// Act
				const result = intersection(branch1, branch2)

				// Assert
				expect(result).toBeInstanceOf(IntersectionSchema)
				expect(result.meta.branches).toEqual([branch1, branch2])
			})
		})
	})
})
