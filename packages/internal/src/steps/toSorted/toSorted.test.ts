/**
 * Test Plan for toSorted.ts
 *
 * This test file covers the `toSorted` step plugin implementation.
 *
 * Functions and Classes:
 * - toSorted: A step plugin that sorts an array using toSorted method.
 *
 * Input Scenarios:
 * - Arrays of numbers: Default sort, custom comparator.
 * - Arrays of strings: Default sort, custom comparator.
 * - Empty arrays: Should remain empty.
 * - Arrays with mixed types: Depending on comparator.
 * - Edge cases: Already sorted, reverse sorted.
 *
 * Expected Outputs and Behaviors:
 * - Success: Returns { value: newSortedArray }.
 *
 * Error Handling and Exceptions:
 * - No exceptions; toSorted handles various inputs gracefully.
 *
 * Coverage Goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { any, array, createValchecker, toSorted } from '../..'

const v = createValchecker({ steps: [array, any, toSorted] })

describe('toSorted plugin', () => {
	describe('default sorting', () => {
		it('should sort numbers in ascending order by default', () => {
			const result = v.array(v.any())
				.toSorted()
				.execute([3, 1, 4, 1, 5])
			expect(result).toEqual({ value: [1, 1, 3, 4, 5] })
		})

		it('should sort strings alphabetically by default', () => {
			const result = v.array(v.any())
				.toSorted()
				.execute(['banana', 'apple', 'cherry'])
			expect(result).toEqual({ value: ['apple', 'banana', 'cherry'] })
		})

		it('should handle empty array', () => {
			const result = v.array(v.any())
				.toSorted()
				.execute([])
			expect(result).toEqual({ value: [] })
		})

		it('should handle single element array', () => {
			const result = v.array(v.any())
				.toSorted()
				.execute([42])
			expect(result).toEqual({ value: [42] })
		})

		it('should handle already sorted array', () => {
			const result = v.array(v.any())
				.toSorted()
				.execute([1, 2, 3, 4, 5])
			expect(result).toEqual({ value: [1, 2, 3, 4, 5] })
		})

		it('should handle reverse sorted array', () => {
			const result = v.array(v.any())
				.toSorted()
				.execute([5, 4, 3, 2, 1])
			expect(result).toEqual({ value: [1, 2, 3, 4, 5] })
		})
	})

	describe('custom comparator', () => {
		it('should sort with custom comparator', () => {
			const result = v.array(v.any())
				.toSorted((a: number, b: number) => b - a)
				.execute([3, 1, 4, 1, 5])
			expect(result).toEqual({ value: [5, 4, 3, 1, 1] })
		})

		it('should sort strings case-insensitively with custom comparator', () => {
			const result = v.array(v.any())
				.toSorted((a: string, b: string) => a.toLowerCase().localeCompare(b.toLowerCase()))
				.execute(['Banana', 'apple', 'Cherry'])
			expect(result).toEqual({ value: ['apple', 'Banana', 'Cherry'] })
		})
	})
})
