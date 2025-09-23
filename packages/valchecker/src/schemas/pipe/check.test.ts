import { describe, expect, it } from 'vitest'
import { defineRunCheck, PipeStepCheckSchema } from './check'

// Specification: ./check.spec.md

describe('tests for `check.ts`', () => {
	// Corresponds to `defineRunCheck` section in the spec
	describe('`defineRunCheck`', () => {
		describe('happy path cases', () => {
			// Test Case: [defineRunCheck.happy.1]
			it('should define a check function', () => {
				// Arrange
				const checkFn = () => {}

				// Act
				const result = defineRunCheck().implement(checkFn)

				// Assert
				expect(result).toBe(checkFn)
			})
		})
	})

	// Corresponds to `PipeStepCheckSchema` section in the spec
	describe('`PipeStepCheckSchema`', () => {
		describe('happy path cases', () => {
			// Test Case: [PipeStepCheckSchema.happy.1]
			it('should execute with success, check returns void', async () => {
				// Arrange
				const check = defineRunCheck().implement(() => {})
				const schema = new PipeStepCheckSchema({ meta: { run: check } })
				const input = { value: 'test' } as any

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ value: { value: 'test' } })
			})

			// Test Case: [PipeStepCheckSchema.happy.2]
			it('should execute with success, check returns true', async () => {
				// Arrange
				const check = defineRunCheck().implement(() => true)
				const schema = new PipeStepCheckSchema({ meta: { run: check } })
				const input = { value: 'test' } as any

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ value: { value: 'test' } })
			})

			// Test Case: [PipeStepCheckSchema.happy.3]
			it('should execute with success, check returns True', async () => {
				// Arrange
				const check = defineRunCheck().implement(() => ({ '~output': 'checked' } as any))
				const schema = new PipeStepCheckSchema({ meta: { run: check } })
				const input = { value: 'test' } as any

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ value: { value: 'test' } })
			})
		})

		describe('edge cases', () => {
			// Test Case: [PipeStepCheckSchema.edge.1]
			it('should execute with failure result', async () => {
				// Arrange
				const check = defineRunCheck().implement(() => {})
				const schema = new PipeStepCheckSchema({ meta: { run: check } })
				const input = { issues: [] } as any

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual(input)
			})

			// Test Case: [PipeStepCheckSchema.edge.2]
			it('should execute with success, check adds issues', async () => {
				// Arrange
				const check = defineRunCheck().implement((_, utils) => {
					utils.addIssue({ code: 'TEST', message: 'test issue' })
				})
				const schema = new PipeStepCheckSchema({ meta: { run: check } })
				const input = { success: true, value: 'test' } as any

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ issues: [{ code: 'TEST', message: 'test issue' }] })
			})
		})

		describe('error cases', () => {
			// Test Case: [PipeStepCheckSchema.error.1]
			it('should execute with success, check returns false', async () => {
				// Arrange
				const check = defineRunCheck().implement(() => false)
				const schema = new PipeStepCheckSchema({ meta: { run: check } })
				const input = { success: true, value: 'test' } as any

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ issues: [{ code: 'CHECK_FAILED', message: 'Invalid value.' }] })
			})

			// Test Case: [PipeStepCheckSchema.error.2]
			it('should execute with success, check returns string', async () => {
				// Arrange
				const check = defineRunCheck().implement(() => 'error message')
				const schema = new PipeStepCheckSchema({ meta: { run: check } })
				const input = { success: true, value: 'test' } as any

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ issues: [{ code: 'CHECK_FAILED', message: 'error message' }] })
			})

			// Test Case: [PipeStepCheckSchema.error.3]
			it('should execute with success, check throws', async () => {
				// Arrange
				const check = defineRunCheck().implement(() => {
					throw new Error('check error')
				})
				const schema = new PipeStepCheckSchema({ meta: { run: check } })
				const input = { success: true, value: 'test' } as any

				// Act
				const result = await schema.execute(input)

				// Assert
				expect(result).toEqual({ issues: [{ code: 'CHECK_FAILED', message: 'Invalid value.', error: new Error('check error') }] })
			})
		})
	})
})
