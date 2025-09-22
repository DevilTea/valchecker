import { describe, expect, it } from 'vitest'
import { instance, InstanceSchema } from './instance'

// Specification: ./instance.spec.md

describe('tests for `instance.ts`', () => {
	// Corresponds to `InstanceSchema` section in the spec
	describe('`InstanceSchema`', () => {
		describe('happy path cases', () => {
			// Test Case: [InstanceSchema.happy.1]
			it('should succeed with instance of constructor', async () => {
				// Arrange
				const schema = new InstanceSchema({ meta: { constructor_: Date } })
				const input = new Date()
				const expected = { value: input }

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(expected)
			})
		})

		describe('error cases', () => {
			// Test Case: [InstanceSchema.error.1]
			it('should fail with non-instance', async () => {
				// Arrange
				const schema = new InstanceSchema({ meta: { constructor_: Date } })
				const input = 'not a date'

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toHaveProperty('issues')
				expect((result as any).issues).toHaveLength(1)
				expect((result as any).issues[0].message).toBe('Invalid instance.')
			})
		})
	})

	describe('`instance`', () => {
		describe('happy path cases', () => {
			// Test Case: [instance.happy.1]
			it('should create instance schema', () => {
				// Arrange
				const constructor_ = Date

				// Act
				const result = instance(constructor_)

				// Assert
				expect(result).toBeInstanceOf(InstanceSchema)
				expect(result.meta.constructor_).toBe(constructor_)
			})
		})
	})
})
