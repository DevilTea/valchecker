/**
 * Test plan for any step:
 * - Functions tested: any validation (accepts any value).
 * - Valid inputs: all types (string, number, boolean, null, undefined, object, array, bigint, symbol).
 * - Invalid inputs: none (any accepts all).
 * - Edge cases: empty object, empty array, zero, empty string.
 * - Expected behaviors: Success returns { value: input }; no issues.
 * - Error handling: No exceptions; no issues.
 * - Coverage goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { any, check, createValchecker } from '../..'

const v = createValchecker({ steps: [any, check] })

describe('any plugin', () => {
	describe('valid inputs', () => {
		it('should pass for string', () => {
			const result = v.any()
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should pass for number', () => {
			const result = v.any()
				.execute(42)
			expect(result)
				.toEqual({ value: 42 })
		})

		it('should pass for boolean true', () => {
			const result = v.any()
				.execute(true)
			expect(result)
				.toEqual({ value: true })
		})

		it('should pass for boolean false', () => {
			const result = v.any()
				.execute(false)
			expect(result)
				.toEqual({ value: false })
		})

		it('should pass for null', () => {
			const result = v.any()
				.execute(null)
			expect(result)
				.toEqual({ value: null })
		})

		it('should pass for undefined', () => {
			const result = v.any()
				.execute(undefined)
			expect(result)
				.toEqual({ value: undefined })
		})

		it('should pass for object', () => {
			const obj = { key: 'value' }
			const result = v.any()
				.execute(obj)
			expect(result)
				.toEqual({ value: obj })
		})

		it('should pass for array', () => {
			const arr = [1, 2, 3]
			const result = v.any()
				.execute(arr)
			expect(result)
				.toEqual({ value: arr })
		})

		it('should pass for bigint', () => {
			const result = v.any()
				.execute(123n)
			expect(result)
				.toEqual({ value: 123n })
		})

		it('should pass for symbol', () => {
			const sym = Symbol('test')
			const result = v.any()
				.execute(sym)
			expect(result)
				.toEqual({ value: sym })
		})
	})

	describe('edge cases', () => {
		it('should pass for empty object', () => {
			const result = v.any()
				.execute({})
			expect(result)
				.toEqual({ value: {} })
		})

		it('should pass for empty array', () => {
			const result = v.any()
				.execute([])
			expect(result)
				.toEqual({ value: [] })
		})

		it('should pass for zero', () => {
			const result = v.any()
				.execute(0)
			expect(result)
				.toEqual({ value: 0 })
		})

		it('should pass for empty string', () => {
			const result = v.any()
				.execute('')
			expect(result)
				.toEqual({ value: '' })
		})
	})

	describe('chaining', () => {
		it('should chain with check', () => {
			const result = v.any()
				.check(val => val !== null)
				.execute('test')
			expect(result)
				.toEqual({ value: 'test' })
		})

		it('should fail chaining with check', () => {
			const result = v.any()
				.check(val => val === null)
				.execute('test')
			expect(result)
				.toEqual({
					issues: [{
						code: 'check:failed',
						message: 'Check failed',
						path: [],
						payload: { value: 'test' },
					}],
				})
		})
	})
})
