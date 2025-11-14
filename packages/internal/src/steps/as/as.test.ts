/**
 * Test Plan for as.ts
 *
 * This test file covers the `as` step plugin implementation.
 *
 * Functions and Classes:
 * - as: The step plugin that casts the type without validation.
 *
 * Input Scenarios:
 * - Any inputs: strings, numbers, objects, arrays, null, undefined, complex types.
 *
 * Expected Outputs and Behaviors:
 * - Success: Always returns the input value unchanged.
 *
 * Error Handling and Exceptions:
 * - No validation; no errors or exceptions.
 *
 * Coverage Goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { as, createValchecker } from '../..'

const v = createValchecker({ steps: [as] })

describe('as plugin', () => {
	describe('valid inputs (all inputs pass through)', () => {
		it('should pass through string', () => {
			const result = v.as<string>().execute('hello')
			expect(result).toEqual({ value: 'hello' })
		})

		it('should pass through number', () => {
			const result = v.as<number>().execute(42)
			expect(result).toEqual({ value: 42 })
		})

		it('should pass through object', () => {
			const obj = { name: 'John', age: 30 }
			const result = v.as<{ name: string, age: number }>().execute(obj)
			expect(result).toEqual({ value: obj })
		})

		it('should pass through array', () => {
			const arr = [1, 2, 3]
			const result = v.as<number[]>().execute(arr)
			expect(result).toEqual({ value: arr })
		})

		it('should pass through null', () => {
			const result = v.as<null>().execute(null)
			expect(result).toEqual({ value: null })
		})

		it('should pass through undefined', () => {
			const result = v.as<undefined>().execute(undefined)
			expect(result).toEqual({ value: undefined })
		})

		it('should pass through complex type', () => {
			interface ComplexType {
				users: Array<{ id: number, name: string }>
				settings: { theme: 'light' | 'dark' }
			}
			const complexValue: ComplexType = {
				users: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
				settings: { theme: 'dark' },
			}
			const result = v.as<ComplexType>().execute(complexValue)
			expect(result).toEqual({ value: complexValue })
		})
	})
})
