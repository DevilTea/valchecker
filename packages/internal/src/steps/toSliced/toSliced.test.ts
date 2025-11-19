/**
 * Test Plan for toSliced.ts
 *
 * This test file covers the `toSliced` step plugin implementation.
 *
 * Functions and Classes:
 * - toSliced: A step plugin that slices an object with a slice method.
 *
 * Input Scenarios:
 * - Arrays: Test slicing with start, start and end parameters.
 * - Strings: Test slicing with start, start and end parameters.
 * - Edge cases: Negative indices, out of bounds, empty slices.
 *
 * Expected Outputs and Behaviors:
 * - Success: Returns { value: slicedPortion }.
 *
 * Error Handling and Exceptions:
 * - No exceptions; slice method handles bounds gracefully.
 *
 * Coverage Goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { any, array, createValchecker, string, toSliced } from '../..'

const v = createValchecker({ steps: [array, string, any, toSliced] })

describe('toSliced plugin', () => {
	describe('array slicing', () => {
		it('should slice array with start index', () => {
			const result = v.array(v.any())
				.toSliced(2)
				.execute([1, 2, 3, 4, 5])
			expect(result)
				.toEqual({ value: [3, 4, 5] })
		})

		it('should slice array with start and end index', () => {
			const result = v.array(v.any())
				.toSliced(1, 4)
				.execute([1, 2, 3, 4, 5])
			expect(result)
				.toEqual({ value: [2, 3, 4] })
		})

		it('should handle negative start index', () => {
			const result = v.array(v.any())
				.toSliced(-2)
				.execute([1, 2, 3, 4, 5])
			expect(result)
				.toEqual({ value: [4, 5] })
		})

		it('should handle negative end index', () => {
			const result = v.array(v.any())
				.toSliced(1, -1)
				.execute([1, 2, 3, 4, 5])
			expect(result)
				.toEqual({ value: [2, 3, 4] })
		})

		it('should handle out of bounds', () => {
			const result = v.array(v.any())
				.toSliced(10)
				.execute([1, 2, 3])
			expect(result)
				.toEqual({ value: [] })
		})
	})

	describe('string slicing', () => {
		it('should slice string with start index', () => {
			const result = v.string()
				.toSliced(2)
				.execute('hello')
			expect(result)
				.toEqual({ value: 'llo' })
		})

		it('should slice string with start and end index', () => {
			const result = v.string()
				.toSliced(1, 4)
				.execute('hello')
			expect(result)
				.toEqual({ value: 'ell' })
		})

		it('should handle negative start index', () => {
			const result = v.string()
				.toSliced(-2)
				.execute('hello')
			expect(result)
				.toEqual({ value: 'lo' })
		})

		it('should handle negative end index', () => {
			const result = v.string()
				.toSliced(1, -1)
				.execute('hello')
			expect(result)
				.toEqual({ value: 'ell' })
		})

		it('should handle out of bounds', () => {
			const result = v.string()
				.toSliced(10)
				.execute('hi')
			expect(result)
				.toEqual({ value: '' })
		})
	})

	describe('edge cases', () => {
		it('should handle empty array', () => {
			const result = v.array(v.any())
				.toSliced(0)
				.execute([])
			expect(result)
				.toEqual({ value: [] })
		})

		it('should handle empty string', () => {
			const result = v.string()
				.toSliced(0)
				.execute('')
			expect(result)
				.toEqual({ value: '' })
		})
	})
})
