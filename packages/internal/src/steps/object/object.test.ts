/**
 * Test Plan for object.ts
 *
 * This test file covers the `object` step plugin implementation.
 *
 * Functions and Classes:
 * - object: The step plugin that validates objects against a struct schema.
 *
 * Input Scenarios:
 * - Non-object inputs: string, number, null, undefined, array.
 * - Valid objects: empty struct, with required/optional properties, extra properties ignored.
 * - Invalid objects: missing required properties, invalid property values.
 * - Mixed scenarios: some valid, some invalid properties.
 * - Async property schemas: transform with async functions.
 * - Edge cases: nested objects, empty objects.
 *
 * Expected Outputs and Behaviors:
 * - Non-objects: Issues with 'object:expected_object'.
 * - Valid: Processed object with validated properties.
 * - Invalid: Issues with paths to invalid properties.
 * - Async: Promise resolution with correct results.
 *
 * Error Handling and Exceptions:
 * - No exceptions; all errors handled via issues.
 *
 * Coverage Goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { createValchecker, number, object, string, transform } from '../..'

const v = createValchecker({ steps: [object, string, number, transform] })

describe('object plugin', () => {
	describe('invalid inputs (not objects)', () => {
		it('should fail for string', () => {
			const result = v.object({}).execute('not an object')
			expect(result).toEqual({
				issues: [{
					code: 'object:expected_object',
					payload: { value: 'not an object' },
					message: 'Expected an object.',
				}],
			})
		})

		it('should fail for number', () => {
			const result = v.object({}).execute(42)
			expect(result).toEqual({
				issues: [{
					code: 'object:expected_object',
					payload: { value: 42 },
					message: 'Expected an object.',
				}],
			})
		})

		it('should fail for null', () => {
			const result = v.object({}).execute(null)
			expect(result).toEqual({
				issues: [{
					code: 'object:expected_object',
					payload: { value: null },
					message: 'Expected an object.',
				}],
			})
		})

		it('should fail for undefined', () => {
			const result = v.object({}).execute(undefined)
			expect(result).toEqual({
				issues: [{
					code: 'object:expected_object',
					payload: { value: undefined },
					message: 'Expected an object.',
				}],
			})
		})

		it('should fail for array', () => {
			const result = v.object({}).execute([])
			expect(result).toEqual({
				issues: [{
					code: 'object:expected_object',
					payload: { value: [] },
					message: 'Expected an object.',
				}],
			})
		})
	})

	describe('custom messages', () => {
		it('should use custom message for expected_object failure', () => {
			const result = v.object({}, () => 'Custom message').execute('not an object')
			expect(result).toEqual({
				issues: [{
					code: 'object:expected_object',
					payload: { value: 'not an object' },
					message: 'Custom message',
				}],
			})
		})
	})

	describe('valid objects', () => {
		it('should pass for empty struct', () => {
			const result = v.object({}).execute({})
			expect(result).toEqual({ value: {} })
		})

		it('should pass for object with required properties', () => {
			const result = v.object({
				name: v.string(),
				age: v.number(),
			}).execute({
				name: 'John',
				age: 30,
			})
			expect(result).toEqual({
				value: {
					name: 'John',
					age: 30,
				},
			})
		})

		it('should ignore extra properties', () => {
			const result = v.object({
				name: v.string(),
			}).execute({
				name: 'John',
				extra: 'ignored',
			})
			expect(result).toEqual({
				value: {
					name: 'John',
				},
			})
		})

		it('should handle optional properties present', () => {
			const result = v.object({
				name: v.string(),
				age: [v.number()],
			}).execute({
				name: 'John',
				age: 30,
			})
			expect(result).toEqual({
				value: {
					name: 'John',
					age: 30,
				},
			})
		})

		it('should handle optional properties missing', () => {
			const result = v.object({
				name: v.string(),
				age: [v.number()],
			}).execute({
				name: 'John',
			})
			expect(result).toEqual({
				value: {
					name: 'John',
					age: undefined,
				},
			})
		})

		it('should fail for missing required property', () => {
			const result = v.object({
				name: v.string(),
				age: v.number(),
			}).execute({
				name: 'John',
			})
			expect(result).toEqual({
				issues: [{
					code: 'number:expected_number',
					path: ['age'],
					payload: { value: undefined },
					message: 'Expected a number (NaN is not allowed).',
				}],
			})
		})

		it('should fail for invalid required property', () => {
			const result = v.object({
				name: v.string(),
				age: v.number(),
			}).execute({
				name: 'John',
				age: 'thirty',
			})
			expect(result).toEqual({
				issues: [{
					code: 'number:expected_number',
					path: ['age'],
					payload: { value: 'thirty' },
					message: 'Expected a number (NaN is not allowed).',
				}],
			})
		})

		it('should fail for invalid optional property', () => {
			const result = v.object({
				name: v.string(),
				age: [v.number()],
			}).execute({
				name: 'John',
				age: 'thirty',
			})
			expect(result).toEqual({
				issues: [{
					code: 'number:expected_number',
					path: ['age'],
					payload: { value: 'thirty' },
					message: 'Expected a number (NaN is not allowed).',
				}],
			})
		})

		it('should collect multiple issues', () => {
			const result = v.object({
				name: v.string(),
				age: v.number(),
			}).execute({
				name: 123,
				age: 'thirty',
			})
			expect(result).toEqual({
				issues: [
					{
						code: 'string:expected_string',
						path: ['name'],
						payload: { value: 123 },
						message: 'Expected a string.',
					},
					{
						code: 'number:expected_number',
						path: ['age'],
						payload: { value: 'thirty' },
						message: 'Expected a number (NaN is not allowed).',
					},
				],
			})
		})

		it('should handle async property schemas', async () => {
			const result = await v.object({
				name: v.string().transform(async x => x.toUpperCase()),
			}).execute({
				name: 'john',
			})
			expect(result).toEqual({
				value: {
					name: 'JOHN',
				},
			})
		})
	})

	describe('edge cases', () => {
		it('should handle nested objects', () => {
			const result = v.object({
				user: v.object({
					name: v.string(),
				}),
			}).execute({
				user: {
					name: 'John',
				},
			})
			expect(result).toEqual({
				value: {
					user: {
						name: 'John',
					},
				},
			})
		})

		it('should fail for nested invalid properties', () => {
			const result = v.object({
				user: v.object({
					name: v.string(),
				}),
			}).execute({
				user: {
					name: 123,
				},
			})
			expect(result).toEqual({
				issues: [{
					code: 'string:expected_string',
					path: ['user', 'name'],
					payload: { value: 123 },
					message: 'Expected a string.',
				}],
			})
		})
	})
})
