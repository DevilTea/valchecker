/**
 * Test Plan for looseObject.ts
 *
 * This test file covers the `looseObject` step plugin implementation.
 *
 * Functions and Classes:
 * - looseObject: The step plugin that validates objects and preserves extra keys.
 *
 * Input Scenarios:
 * - Valid objects: required/optional properties, extra keys, nested.
 * - Invalid inputs: non-objects.
 * - Invalid properties: required/optional fail.
 * - Async: with transform.
 *
 * Expected Outputs and Behaviors:
 * - Success: Returns validated object with extra keys.
 * - Failure: Issues with paths for invalid properties.
 * - Async: Promise resolution.
 *
 * Error Handling and Exceptions:
 * - No exceptions; all errors handled via issues.
 *
 * Coverage Goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { createValchecker, looseObject, number, string, transform } from '../..'

const v = createValchecker({ steps: [looseObject, string, number, transform] })

describe('looseObject plugin', () => {
	describe('valid objects', () => {
		it('should pass for basic object with required properties', () => {
			const result = v.looseObject({
				name: v.string(),
				age: v.number(),
			})
				.execute({ name: 'John', age: 30 })
			expect(result)
				.toEqual({ value: { name: 'John', age: 30 } })
		})

		it('should pass for object with optional properties present', () => {
			const result = v.looseObject({
				name: v.string(),
				age: [v.number()],
			})
				.execute({ name: 'John', age: 30 })
			expect(result)
				.toEqual({ value: { name: 'John', age: 30 } })
		})

		it('should pass for object with optional properties missing', () => {
			const result = v.looseObject({
				name: v.string(),
				age: [v.number()],
			})
				.execute({ name: 'John' })
			expect(result)
				.toEqual({ value: { name: 'John' } })
		})

		it('should pass for mixed required and optional properties', () => {
			const result = v.looseObject({
				name: v.string(),
				age: [v.number()],
				email: v.string(),
			})
				.execute({ name: 'John', email: 'john@example.com' })
			expect(result)
				.toEqual({ value: { name: 'John', email: 'john@example.com' } })
		})

		it('should preserve extra keys in output', () => {
			const result = v.looseObject({
				name: v.string(),
			})
				.execute({ name: 'John', extra: 'value', another: 123 })
			expect(result)
				.toEqual({ value: { name: 'John', extra: 'value', another: 123 } })
		})

		it('should handle nested object validation', () => {
			const result = v.looseObject({
				user: v.looseObject({
					name: v.string(),
					age: v.number(),
				}),
			})
				.execute({ user: { name: 'John', age: 30 } })
			expect(result)
				.toEqual({ value: { user: { name: 'John', age: 30 } } })
		})

		it('should handle async validation', async () => {
			const asyncSchema = v.number()
				.transform(async (x: number) => x * 2)
			const result = await v.looseObject({
				value: asyncSchema,
			})
				.execute({ value: 5 })
			expect(result)
				.toEqual({ value: { value: 10 } })
		})

		it('should handle async validation with multiple properties (triggers chaining)', async () => {
			const asyncSchema = v.number()
				.transform(async (x: number) => x * 2)
			const result = await v.looseObject({
				value: asyncSchema,
				name: v.string(),
				count: v.number(),
			})
				.execute({ value: 5, name: 'test', count: 10, extra: 'ignored' })
			expect(result)
				.toEqual({ value: { value: 10, name: 'test', count: 10, extra: 'ignored' } })
		})

		it('should handle async failure in property chain', async () => {
			const failSchema = v.number()
				.transform(async (_x: number) => {
					throw new Error('fail')
				})
			const result = await v.looseObject({
				value: v.number()
					.transform(async (x: number) => x * 2),
				name: v.string(),
				count: failSchema,
			})
				.execute({ value: 5, name: 'test', count: 10 })
			expect(result)
				.toEqual({
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
			const result = await v.looseObject({
				value: v.number()
					.transform((x: number) => firstProp ? (firstProp = false, Promise.resolve(x * 2)) : x),
				name: v.string(),
				count: v.number(),
			})
				.execute({ value: 5, name: 'test', count: 10, extra: 'ignored' })
			expect(result)
				.toEqual({ value: { value: 10, name: 'test', count: 10, extra: 'ignored' } })
		})
	})

	describe('invalid inputs (not objects)', () => {
		it('should fail for string', () => {
			const result = v.looseObject({})
				.execute('string')
			expect(result)
				.toEqual({
					issues: [{
						code: 'looseObject:expected_object',
						message: 'Expected an object.',
						path: [],
						payload: { value: 'string' },
					}],
				})
		})

		it('should fail for number', () => {
			const result = v.looseObject({})
				.execute(123)
			expect(result)
				.toEqual({
					issues: [{
						code: 'looseObject:expected_object',
						message: 'Expected an object.',
						path: [],
						payload: { value: 123 },
					}],
				})
		})

		it('should fail for array', () => {
			const result = v.looseObject({})
				.execute([1, 2, 3])
			expect(result)
				.toEqual({
					issues: [{
						code: 'looseObject:expected_object',
						message: 'Expected an object.',
						path: [],
						payload: { value: [1, 2, 3] },
					}],
				})
		})

		it('should fail for null', () => {
			const result = v.looseObject({})
				.execute(null)
			expect(result)
				.toEqual({
					issues: [{
						code: 'looseObject:expected_object',
						message: 'Expected an object.',
						path: [],
						payload: { value: null },
					}],
				})
		})

		it('should fail for undefined', () => {
			const result = v.looseObject({})
				.execute(undefined)
			expect(result)
				.toEqual({
					issues: [{
						code: 'looseObject:expected_object',
						message: 'Expected an object.',
						path: [],
						payload: { value: undefined },
					}],
				})
		})
	})

	describe('invalid properties', () => {
		it('should fail when required property validation fails', () => {
			const result = v.looseObject({
				name: v.string(),
				age: v.number(),
			})
				.execute({ name: 'John', age: 'thirty' })
			expect(result)
				.toEqual({
					issues: [{
						code: 'number:expected_number',
						message: 'Expected a number (NaN is not allowed).',
						path: ['age'],
						payload: { value: 'thirty' },
					}],
				})
		})

		it('should fail when optional property validation fails', () => {
			const result = v.looseObject({
				name: v.string(),
				age: [v.number()],
			})
				.execute({ name: 'John', age: 'thirty' })
			expect(result)
				.toEqual({
					issues: [{
						code: 'number:expected_number',
						message: 'Expected a number (NaN is not allowed).',
						path: ['age'],
						payload: { value: 'thirty' },
					}],
				})
		})
	})

	describe('custom messages', () => {
		it('should use custom message for expected_object failure', () => {
			const result = v.looseObject({}, () => 'Custom message')
				.execute('not an object')
			expect(result)
				.toEqual({
					issues: [{
						code: 'looseObject:expected_object',
						message: 'Custom message',
						path: [],
						payload: { value: 'not an object' },
					}],
				})
		})
	})
})
