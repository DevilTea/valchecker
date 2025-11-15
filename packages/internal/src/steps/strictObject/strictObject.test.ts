/**
 * Test Plan for strictObject.ts
 *
 * This test file covers the `strictObject` step plugin implementation.
 *
 * Functions and Classes:
 * - strictObject: The step plugin that validates objects and rejects extra keys.
 *
 * Input Scenarios:
 * - Valid objects: required/optional properties, no extra keys, nested.
 * - Invalid inputs: non-objects.
 * - Invalid properties: required/optional fail, extra keys.
 * - Async: with transform.
 *
 * Expected Outputs and Behaviors:
 * - Success: Returns validated object without extra keys.
 * - Failure: Issues with paths for invalid properties or unexpected keys.
 * - Async: Promise resolution.
 *
 * Error Handling and Exceptions:
 * - No exceptions; all errors handled via issues.
 *
 * Coverage Goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { createValchecker, number, strictObject, string, transform } from '../..'

const v = createValchecker({ steps: [strictObject, string, number, transform] })

describe('strictObject plugin', () => {
	describe('valid objects', () => {
		it('should pass for basic object with required properties', () => {
			const result = v.strictObject({
				name: v.string(),
				age: v.number(),
			}).execute({ name: 'John', age: 30 })
			expect(result).toEqual({ value: { name: 'John', age: 30 } })
		})

		it('should pass for object with optional properties present', () => {
			const result = v.strictObject({
				name: v.string(),
				age: [v.number()],
			}).execute({ name: 'John', age: 30 })
			expect(result).toEqual({ value: { name: 'John', age: 30 } })
		})

		it('should pass for object with optional properties missing', () => {
			const result = v.strictObject({
				name: v.string(),
				age: [v.number()],
			}).execute({ name: 'John' })
			expect(result).toEqual({ value: { name: 'John' } })
		})

		it('should pass for mixed required and optional properties', () => {
			const result = v.strictObject({
				name: v.string(),
				age: [v.number()],
				email: v.string(),
			}).execute({ name: 'John', email: 'john@example.com' })
			expect(result).toEqual({ value: { name: 'John', email: 'john@example.com' } })
		})

		it('should handle nested object validation', () => {
			const result = v.strictObject({
				user: v.strictObject({
					name: v.string(),
					age: v.number(),
				}),
			}).execute({ user: { name: 'John', age: 30 } })
			expect(result).toEqual({ value: { user: { name: 'John', age: 30 } } })
		})

		it('should handle async validation', async () => {
			const asyncSchema = v.number().transform(async (x: number) => x * 2)
			const result = await v.strictObject({
				value: asyncSchema,
			}).execute({ value: 5 })
			expect(result).toEqual({ value: { value: 10 } })
		})

		it('should handle async validation with multiple properties (triggers chaining)', async () => {
			const asyncSchema = v.number().transform(async (x: number) => x * 2)
			const result = await v.strictObject({
				value: asyncSchema,
				name: v.string(),
				count: v.number(),
			}).execute({ value: 5, name: 'test', count: 10 })
			expect(result).toEqual({ value: { value: 10, name: 'test', count: 10 } })
		})

		it('should handle async failure in property chain', async () => {
			const failSchema = v.number().transform(async (_x: number) => {
				throw new Error('fail')
			})
			const result = await v.strictObject({
				value: v.number().transform(async (x: number) => x * 2),
				name: v.string(),
				count: failSchema,
			}).execute({ value: 5, name: 'test', count: 10 })
			expect(result).toEqual({
				issues: [{
					code: 'transform:failed',
					path: ['count'],
					payload: { value: 10, error: new Error('fail') },
					message: 'Transform failed',
				}],
			})
		})

		it('should handle mixed async and sync properties in chain', async () => {
			let firstProp = true
			const result = await v.strictObject({
				value: v.number().transform((x: number) => firstProp ? (firstProp = false, Promise.resolve(x * 2)) : x),
				name: v.string(),
				count: v.number(),
			}).execute({ value: 5, name: 'test', count: 10 })
			expect(result).toEqual({ value: { value: 10, name: 'test', count: 10 } })
		})
	})

	describe('invalid inputs (not objects)', () => {
		it('should fail for string', () => {
			const result = v.strictObject({}).execute('string')
			expect(result).toEqual({
				issues: [{
					code: 'strictObject:expected_object',
					payload: { value: 'string' },
					message: 'Expected an object.',
				}],
			})
		})

		it('should fail for number', () => {
			const result = v.strictObject({}).execute(123)
			expect(result).toEqual({
				issues: [{
					code: 'strictObject:expected_object',
					payload: { value: 123 },
					message: 'Expected an object.',
				}],
			})
		})

		it('should fail for array', () => {
			const result = v.strictObject({}).execute([1, 2, 3])
			expect(result).toEqual({
				issues: [{
					code: 'strictObject:expected_object',
					payload: { value: [1, 2, 3] },
					message: 'Expected an object.',
				}],
			})
		})

		it('should fail for null', () => {
			const result = v.strictObject({}).execute(null)
			expect(result).toEqual({
				issues: [{
					code: 'strictObject:expected_object',
					payload: { value: null },
					message: 'Expected an object.',
				}],
			})
		})

		it('should fail for undefined', () => {
			const result = v.strictObject({}).execute(undefined)
			expect(result).toEqual({
				issues: [{
					code: 'strictObject:expected_object',
					payload: { value: undefined },
					message: 'Expected an object.',
				}],
			})
		})
	})

	describe('invalid properties', () => {
		it('should fail when required property validation fails', () => {
			const result = v.strictObject({
				name: v.string(),
				age: v.number(),
			}).execute({ name: 'John', age: 'thirty' })
			expect(result).toEqual({
				issues: [{
					code: 'number:expected_number',
					payload: { value: 'thirty' },
					message: 'Expected a number (NaN is not allowed).',
					path: ['age'],
				}],
			})
		})

		it('should fail when optional property validation fails', () => {
			const result = v.strictObject({
				name: v.string(),
				age: [v.number()],
			}).execute({ name: 'John', age: 'thirty' })
			expect(result).toEqual({
				issues: [{
					code: 'number:expected_number',
					payload: { value: 'thirty' },
					message: 'Expected a number (NaN is not allowed).',
					path: ['age'],
				}],
			})
		})

		it('should fail for extra keys', () => {
			const result = v.strictObject({
				name: v.string(),
			}).execute({ name: 'John', extra: 'value', another: 123 })
			expect(result).toEqual({
				issues: [{
					code: 'strictObject:unexpected_keys',
					payload: { value: { name: 'John', extra: 'value', another: 123 }, keys: ['extra', 'another'] },
					message: 'Unexpected object keys found.',
				}],
			})
		})
	})

	describe('custom messages', () => {
		it('should use custom message for expected_object failure', () => {
			const result = v.strictObject({}, issue => `Custom: ${issue.code}`).execute('not an object')
			expect(result).toEqual({
				issues: [{
					code: 'strictObject:expected_object',
					payload: { value: 'not an object' },
					message: 'Custom: strictObject:expected_object',
				}],
			})
		})

		it('should use custom message for unexpected_keys failure', () => {
			const result = v.strictObject(
				{ name: v.string() },
				(issue) => {
					if (issue.code === 'strictObject:unexpected_keys') {
						return `Custom: ${issue.code} - ${issue.payload.keys.join(', ')}`
					}
					return `Custom: ${issue.code}`
				},
			).execute({ name: 'John', extra: 'value' })
			expect(result).toEqual({
				issues: [{
					code: 'strictObject:unexpected_keys',
					payload: { value: { name: 'John', extra: 'value' }, keys: ['extra'] },
					message: 'Custom: strictObject:unexpected_keys - extra',
				}],
			})
		})
	})
})
