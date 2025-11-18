/**
 * Test Plan for generic.ts
 *
 * This test file covers the `generic` step plugin implementation.
 *
 * Functions and Classes:
 * - generic: The step plugin that adds a step from another valchecker with specified generic type.
 *
 * Input Scenarios:
 * - Using generic with direct step: number, string.
 * - Using generic with factory function: string.
 * - Integration with other steps: inside array, inside object.
 * - Invalid inputs: when added step fails.
 *
 * Expected Outputs and Behaviors:
 * - Success: The added step executes correctly, returns value.
 * - Failure: Issues from the added step.
 * - Async: Not applicable.
 *
 * Error Handling and Exceptions:
 * - No exceptions; all errors handled via issues from the added step.
 *
 * Coverage Goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { array, createValchecker, generic, number, object, string } from '../..'

const v = createValchecker({ steps: [generic, array, number, object, string] })

describe('generic plugin', () => {
	describe('valid generics (direct step)', () => {
		it('should add and execute a number step', () => {
			const schema = v.generic<{ output: number }>(v.number())
			const result = schema.execute(42)
			expect(result).toEqual({ value: 42 })
		})

		it('should add and execute a string step', () => {
			const schema = v.generic<{ output: string }>(v.string())
			const result = schema.execute('hello')
			expect(result).toEqual({ value: 'hello' })
		})
	})

	describe('invalid generics (added step fails)', () => {
		it('should fail if the added step fails', () => {
			const schema = v.generic<{ output: number }>(v.number())
			const result = schema.execute('not a number')
			expect(result).toEqual({
				issues: [{
					code: 'number:expected_number',
					payload: { value: 'not a number' },
					message: 'Expected a number (NaN is not allowed).',
				}],
			})
		})
	})

	describe('valid generics (factory function)', () => {
		it('should call the factory and add the step', () => {
			const schema = v.generic<{ output: string }>(() => v.string())
			const result = schema.execute('world')
			expect(result).toEqual({ value: 'world' })
		})

		it('should handle recursive structures using generic', () => {
			interface MyNode {
				id: number
				children?: MyNode[]
			}

			const nodeSchema = v.object({
				id: v.number(),
				// Required to use a factory function with specifying return type `any` to avoid circular type reference.
				children: [v.array(v.generic<{ output: MyNode }>((): any => nodeSchema))],
			})

			const result = nodeSchema.execute({
				id: 1,
				children: [
					{ id: 2 },
					{ id: 3, children: [{ id: 4 }] },
				],
			})
			expect(result).toEqual({
				value: {
					id: 1,
					children: [
						{ id: 2 },
						{ id: 3, children: [{ id: 4 }] },
					],
				},
			})
		})
	})

	describe('integration with other steps', () => {
		it('should work inside array', () => {
			const schema = v.array(v.generic<{ output: number }>(v.number()))
			const result = schema.execute([1, 2, 3])
			expect(result).toEqual({ value: [1, 2, 3] })
		})

		it('should work inside object', () => {
			const schema = v.object({
				value: v.generic<{ output: string }>(v.string()),
			})
			const result = schema.execute({ value: 'test' })
			expect(result).toEqual({ value: { value: 'test' } })
		})
	})

	describe('edge cases', () => {
		it('should handle empty factory', () => {
			const schema = v.generic<{ output: string }>(() => v.string())
			const result = schema.execute('')
			expect(result).toEqual({ value: '' })
		})
	})
})
