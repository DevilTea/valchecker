/**
 * Test Plan for toFiltered.ts
 *
 * This test file covers the `toFiltered` step plugin implementation.
 *
 * Functions and Classes:
 * - toFiltered: A step plugin that filters an array using the filter method.
 *
 * Input Scenarios:
 * - Arrays of numbers: Filter even numbers, etc.
 * - Arrays of strings: Filter by length, etc.
 * - Arrays of objects: Filter by property.
 * - Empty arrays: Should remain empty.
 * - Arrays with mixed types.
 * - Filter with index parameter.
 *
 * Expected Outputs and Behaviors:
 * - Success: Returns { value: filteredArray }.
 *
 * Error Handling and Exceptions:
 * - Predicate exceptions become operation issues; non-callback method errors remain internal.
 *
 * Coverage Goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { any, array, createValchecker, toFiltered, transform } from '../..'

const v = createValchecker({ steps: [array, any, toFiltered, transform] })

describe('toFiltered plugin', () => {
	describe('basic filtering', () => {
		it('should filter numbers greater than 3', () => {
			const result = v.array(v.any())
				.toFiltered((x: number) => x > 3)
				.execute([1, 2, 3, 4, 5])
			expect(result)
				.toEqual({ value: [4, 5] })
		})

		it('should filter strings starting with "a"', () => {
			const result = v.array(v.any())
				.toFiltered((s: string) => s.startsWith('a'))
				.execute(['apple', 'banana', 'avocado', 'cherry'])
			expect(result)
				.toEqual({ value: ['apple', 'avocado'] })
		})

		it('should filter with index parameter', () => {
			const result = v.array(v.any())
				.toFiltered((_: any, index: number) => index % 2 === 0)
				.execute([10, 20, 30, 40, 50])
			expect(result)
				.toEqual({ value: [10, 30, 50] })
		})

		it('should filter objects by property', () => {
			const result = v.array(v.any())
				.toFiltered((obj: { active: boolean }) => obj.active)
				.execute([{ active: true, id: 1 }, { active: false, id: 2 }, { active: true, id: 3 }])
			expect(result)
				.toEqual({ value: [{ active: true, id: 1 }, { active: true, id: 3 }] })
		})
	})

	describe('edge cases', () => {
		it('should handle empty array', () => {
			const result = v.array(v.any())
				.toFiltered((x: number) => x > 0)
				.execute([])
			expect(result)
				.toEqual({ value: [] })
		})

		it('should handle filter that removes all elements', () => {
			const result = v.array(v.any())
				.toFiltered((x: number) => x > 100)
				.execute([1, 2, 3])
			expect(result)
				.toEqual({ value: [] })
		})

		it('should handle filter that keeps all elements', () => {
			const result = v.array(v.any())
				.toFiltered((x: number) => x >= 0)
				.execute([1, 2, 3])
			expect(result)
				.toEqual({ value: [1, 2, 3] })
		})
	})

	it('should report predicate exceptions with item and index', () => {
		const error = new Error('predicate')
		const result = v.array(v.any())
			.toFiltered((_item: number, index) => {
				if (index === 1)
					throw error
				return true
			}, undefined, 'Filter failed')
			.execute([1, 2, 3])
		expect(result).toMatchObject({
			issues: [{
				code: 'toFiltered:callback_failed',
				category: 'operation',
				message: 'Filter failed',
				payload: { value: [1, 2, 3], item: 2, index: 1, error },
			}],
		})
	})

	it('should leave non-predicate filter failures to the core boundary', () => {
		const error = new Error('filter method')
		const value = [] as any[] & { filter: typeof Array.prototype.filter }
		value.filter = () => { throw error }
		const result = v.transform(() => value)
			.toFiltered(() => true)
			.execute(null)
		expect(result).toMatchObject({
			issues: [{
				code: 'core:unknown_exception',
				category: 'internal',
				payload: { error },
			}],
		})
	})
})