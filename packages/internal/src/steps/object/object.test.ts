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
			const result = v.object({})
				.execute('not an object')
			expect(result)
				.toEqual({
					issues: [{
						code: 'object:expected_object',
						message: 'Expected an object.',
						path: [],
						payload: { value: 'not an object' },
					}],
				})
		})

		it('should fail for number', () => {
			const result = v.object({})
				.execute(42)
			expect(result)
				.toEqual({
					issues: [{
						code: 'object:expected_object',
						message: 'Expected an object.',
						path: [],
						payload: { value: 42 },
					}],
				})
		})

		it('should fail for null', () => {
			const result = v.object({})
				.execute(null)
			expect(result)
				.toEqual({
					issues: [{
						code: 'object:expected_object',
						message: 'Expected an object.',
						path: [],
						payload: { value: null },
					}],
				})
		})

		it('should fail for undefined', () => {
			const result = v.object({})
				.execute(undefined)
			expect(result)
				.toEqual({
					issues: [{
						code: 'object:expected_object',
						message: 'Expected an object.',
						path: [],
						payload: { value: undefined },
					}],
				})
		})

		it('should fail for array', () => {
			const result = v.object({})
				.execute([])
			expect(result)
				.toEqual({
					issues: [{
						code: 'object:expected_object',
						message: 'Expected an object.',
						path: [],
						payload: { value: [] },
					}],
				})
		})
	})

	describe('custom messages', () => {
		it('should use custom message for expected_object failure', () => {
			const result = v.object({}, () => 'Custom message')
				.execute('not an object')
			expect(result)
				.toEqual({
					issues: [{
						code: 'object:expected_object',
						message: 'Custom message',
						path: [],
						payload: { value: 'not an object' },
					}],
				})
		})
	})

	describe('valid objects', () => {
		it('should pass for empty struct', () => {
			const result = v.object({})
				.execute({})
			expect(result)
				.toEqual({ value: {} })
		})

		it('should pass for object with required properties', () => {
			const result = v.object({
				name: v.string(),
				age: v.number(),
			})
				.execute({
					name: 'John',
					age: 30,
				})
			expect(result)
				.toEqual({
					value: {
						name: 'John',
						age: 30,
					},
				})
		})

		it('should ignore extra properties', () => {
			const result = v.object({
				name: v.string(),
			})
				.execute({
					name: 'John',
					extra: 'ignored',
				})
			expect(result)
				.toEqual({
					value: {
						name: 'John',
					},
				})
		})

		it('should handle optional properties present', () => {
			const result = v.object({
				name: v.string(),
				age: [v.number()],
			})
				.execute({
					name: 'John',
					age: 30,
				})
			expect(result)
				.toEqual({
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
			})
				.execute({
					name: 'John',
				})
			expect(result)
				.toEqual({
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
			})
				.execute({
					name: 'John',
				})
			expect(result)
				.toEqual({
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
			})
				.execute({
					name: 'John',
					age: 'thirty',
				})
			expect(result)
				.toEqual({
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
			})
				.execute({
					name: 'John',
					age: 'thirty',
				})
			expect(result)
				.toEqual({
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
			})
				.execute({
					name: 123,
					age: 'thirty',
				})
			expect(result)
				.toEqual({
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
				name: v.string()
					.transform(async x => x.toUpperCase()),
			})
				.execute({
					name: 'john',
				})
			expect(result)
				.toEqual({
					value: {
						name: 'JOHN',
					},
				})
		})

		it('should handle async property schemas with multiple properties (triggers chaining)', async () => {
			const result = await v.object({
				name: v.string()
					.transform(async x => x.toUpperCase()),
				age: v.number(),
				city: v.string(),
			})
				.execute({
					name: 'john',
					age: 30,
					city: 'NYC',
				})
			expect(result)
				.toEqual({
					value: {
						name: 'JOHN',
						age: 30,
						city: 'NYC',
					},
				})
		})

		it('should handle async failure in property chain', async () => {
			const result = await v.object({
				name: v.string()
					.transform(async x => x.toUpperCase()),
				age: v.number(),
				city: v.string()
					.transform(async (_x) => { throw new Error('fail') }),
			})
				.execute({
					name: 'john',
					age: 30,
					city: 'NYC',
				})
			expect(result)
				.toEqual({
					issues: [{
						code: 'transform:failed',
						path: ['city'],
						payload: { value: 'NYC', error: new Error('fail') },
						message: 'Transform failed',
					}],
				})
		})

		it('should handle mixed async and sync properties in chain', async () => {
			let firstProp = true
			const result = await v.object({
				name: v.string()
					.transform(x => firstProp ? (firstProp = false, Promise.resolve(x.toUpperCase())) : x),
				age: v.number(),
				city: v.string(),
			})
				.execute({
					name: 'john',
					age: 30,
					city: 'NYC',
				})
			expect(result)
				.toEqual({
					value: {
						name: 'JOHN',
						age: 30,
						city: 'NYC',
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
			})
				.execute({
					user: {
						name: 'John',
					},
				})
			expect(result)
				.toEqual({
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
			})
				.execute({
					user: {
						name: 123,
					},
				})
			expect(result)
				.toEqual({
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
