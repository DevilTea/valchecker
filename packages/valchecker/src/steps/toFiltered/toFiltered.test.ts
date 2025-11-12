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
 * - No exceptions; filter handles various inputs gracefully.
 *
 * Coverage Goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { any, array, createValchecker, toFiltered } from '../..'

const v = createValchecker({ steps: [array, any, toFiltered] })

describe('toFiltered plugin', () => {
	describe('basic filtering', () => {
		it('should filter numbers greater than 3', () => {
			const result = v.array(v.any())
				.toFiltered((x: number) => x > 3)
				.execute([1, 2, 3, 4, 5])
			expect(result).toEqual({ value: [4, 5] })
		})

		it('should filter strings starting with "a"', () => {
			const result = v.array(v.any())
				.toFiltered((s: string) => s.startsWith('a'))
				.execute(['apple', 'banana', 'avocado', 'cherry'])
			expect(result).toEqual({ value: ['apple', 'avocado'] })
		})

		it('should filter with index parameter', () => {
			const result = v.array(v.any())
				.toFiltered((_: any, index: number) => index % 2 === 0)
				.execute([10, 20, 30, 40, 50])
			expect(result).toEqual({ value: [10, 30, 50] })
		})

		it('should filter objects by property', () => {
			const result = v.array(v.any())
				.toFiltered((obj: { active: boolean }) => obj.active)
				.execute([{ active: true, id: 1 }, { active: false, id: 2 }, { active: true, id: 3 }])
			expect(result).toEqual({ value: [{ active: true, id: 1 }, { active: true, id: 3 }] })
		})
	})

	describe('edge cases', () => {
		it('should handle empty array', () => {
			const result = v.array(v.any())
				.toFiltered((x: number) => x > 0)
				.execute([])
			expect(result).toEqual({ value: [] })
		})

		it('should handle filter that removes all elements', () => {
			const result = v.array(v.any())
				.toFiltered((x: number) => x > 100)
				.execute([1, 2, 3])
			expect(result).toEqual({ value: [] })
		})

		it('should handle filter that keeps all elements', () => {
			const result = v.array(v.any())
				.toFiltered((x: number) => x >= 0)
				.execute([1, 2, 3])
			expect(result).toEqual({ value: [1, 2, 3] })
		})
	})
})
