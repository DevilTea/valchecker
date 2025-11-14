/**
 * Test Plan for use.ts
 *
 * This test file covers the `use` step plugin implementation.
 *
 * Functions and Classes:
 * - use: A step plugin that delegates validation to another valchecker schema.
 *
 * Input Scenarios:
 * - Valid inputs: Values that pass the provided schema's validation.
 * - Invalid inputs: Values that fail the provided schema's validation.
 * - Schema transformations: Schema that transforms values (e.g., string to uppercase).
 * - Nested schema: Schema that itself uses other steps.
 * - Async schema: Schema with async operations.
 * - Edge cases: Empty schemas, chained use steps.
 *
 * Expected Outputs and Behaviors:
 * - Valid: Success result with the output from the provided schema.
 * - Invalid: Failure result with issues from the provided schema.
 * - Transformations: Transformed value is passed through.
 * - Async: Promise resolution with correct results.
 *
 * Error Handling and Exceptions:
 * - No exceptions; all errors handled via issues from the provided schema.
 *
 * Coverage Goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { check, createValchecker, number, string, toLowercase, toTrimmed, transform, unknown, use } from '../..'

const v = createValchecker({ steps: [unknown, string, number, use, transform, check, toLowercase, toTrimmed] })

describe('use plugin', () => {
	describe('valid inputs', () => {
		it('should pass value through a string schema', () => {
			const stringSchema = v.string()
			const result = v.unknown()
				.use(stringSchema)
				.execute('hello')
			expect(result).toEqual({ value: 'hello' })
		})

		it('should pass value through a number schema', () => {
			const numberSchema = v.number()
			const result = v.unknown()
				.use(numberSchema)
				.execute(42)
			expect(result).toEqual({ value: 42 })
		})

		it('should handle schema with transformations', () => {
			const uppercaseSchema = v.string()
				.transform(x => x.toUpperCase())
			const result = v.unknown()
				.use(uppercaseSchema)
				.execute('hello')
			expect(result).toEqual({ value: 'HELLO' })
		})

		it('should handle schema with multiple steps', () => {
			const emailSchema = v.string()
				.toLowercase()
				.toTrimmed()
			const result = v.unknown()
				.use(emailSchema)
				.execute('  TEST@EXAMPLE.COM  ')
			expect(result).toEqual({ value: 'test@example.com' })
		})

		it('should handle chained use steps', () => {
			const schema1 = v.string().toLowercase()
			const schema2 = v.string().toTrimmed()
			const result = v.unknown()
				.use(schema1)
				.use(schema2)
				.execute('  HELLO  ')
			expect(result).toEqual({ value: 'hello' })
		})

		it('should handle schema with check', () => {
			const positiveNumberSchema = v.number()
				.check(x => x > 0, 'Must be positive')
			const result = v.unknown()
				.use(positiveNumberSchema)
				.execute(42)
			expect(result).toEqual({ value: 42 })
		})
	})

	describe('invalid inputs', () => {
		it('should fail when provided schema fails', () => {
			const stringSchema = v.string()
			const result = v.unknown()
				.use(stringSchema)
				.execute(123)
			expect(result).toEqual({
				issues: [{
					code: 'string:expected_string',
					payload: { value: 123 },
					message: 'Expected a string.',
				}],
			})
		})

		it('should fail when check in schema fails', () => {
			const positiveNumberSchema = v.number()
				.check(x => x > 0, 'Must be positive')
			const result = v.unknown()
				.use(positiveNumberSchema)
				.execute(-5)
			expect(result).toEqual({
				issues: [{
					code: 'check:failed',
					payload: { value: -5 },
					message: 'Must be positive',
				}],
			})
		})

		it('should pass through all issues from schema', () => {
			const stringSchema = v.string()
			const result = v.unknown()
				.use(stringSchema)
				.execute(null)
			expect(result).toEqual({
				issues: [{
					code: 'string:expected_string',
					payload: { value: null },
					message: 'Expected a string.',
				}],
			})
		})
	})

	describe('async scenarios', () => {
		it('should handle async schema', async () => {
			const asyncSchema = v.string()
				.transform(async (x) => {
					await new Promise(resolve => setTimeout(resolve, 1))
					return x.toUpperCase()
				})
			const result = await v.unknown()
				.use(asyncSchema as any)
				.execute('hello')
			expect(result).toEqual({ value: 'HELLO' })
		})

		it('should handle async schema with failure', async () => {
			const asyncSchema = v.string()
				.check(async (x) => {
					await new Promise(resolve => setTimeout(resolve, 1))
					return x.length > 5 || 'Too short'
				})
			const result = await v.unknown()
				.use(asyncSchema as any)
				.execute('hi')
			expect(result).toEqual({
				issues: [{
					code: 'check:failed',
					payload: { value: 'hi' },
					message: 'Too short',
				}],
			})
		})
	})

	describe('edge cases', () => {
		it('should handle unknown to unknown', () => {
			const unknownSchema = v.unknown()
			const result = v.unknown()
				.use(unknownSchema)
				.execute('anything')
			expect(result).toEqual({ value: 'anything' })
		})

		it('should work after other steps', () => {
			const numberSchema = v.number()
			const result = v.string()
				.transform(x => Number.parseInt(x))
				.use(numberSchema)
				.execute('42')
			expect(result).toEqual({ value: 42 })
		})

		it('should handle type conversion', () => {
			const numberSchema = v.number()
			const result = v.string()
				.transform(x => Number.parseInt(x))
				.use(numberSchema)
				.execute('123')
			expect(result).toEqual({ value: 123 })
		})

		it('should not execute use when previous step fails', () => {
			const numberSchema = v.number()
			const result = v.string()
				.use(numberSchema)
				.execute(123)
			expect(result).toEqual({
				issues: [{
					code: 'string:expected_string',
					payload: { value: 123 },
					message: 'Expected a string.',
				}],
			})
		})
	})

	describe('real-world scenarios', () => {
		it('should support reusable email validation', () => {
			const emailSchema = v.string()
				.toLowercase()
				.toTrimmed()
				.check(x => x.includes('@'), 'Must be a valid email')

			const result = v.unknown()
				.use(emailSchema)
				.execute('  TEST@EXAMPLE.COM  ')

			expect(result).toEqual({ value: 'test@example.com' })
		})

		it('should support reusable positive number validation', () => {
			const positiveNumberSchema = v.number()
				.check(x => x > 0, 'Must be positive')

			const result1 = v.unknown()
				.use(positiveNumberSchema)
				.execute(42)
			expect(result1).toEqual({ value: 42 })

			const result2 = v.unknown()
				.use(positiveNumberSchema)
				.execute(-5)
			expect(result2).toEqual({
				issues: [{
					code: 'check:failed',
					payload: { value: -5 },
					message: 'Must be positive',
				}],
			})
		})
	})
})
