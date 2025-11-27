/**
 * Test plan for bigint step:
 * - Functions tested: bigint validation with optional custom messages.
 * - Valid inputs: bigints (positive, zero, negative, large).
 * - Invalid inputs: non-bigint types (number, string, boolean, null, undefined, object, array, symbol).
 * - Edge cases: large bigints.
 * - Expected behaviors: Success returns { value: bigint }; failure returns { issues: [{ code: 'bigint:expected_bigint', payload: { value }, message }] }.
 * - Error handling: No exceptions; all errors via issues.
 * - Coverage goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { bigint, createValchecker, min } from '../..'

const v = createValchecker({ steps: [bigint, min] })

describe('bigint plugin', () => {
	describe('valid inputs', () => {
		it('should pass for positive bigint', () => {
			const result = v.bigint()
				.execute(1n)
			expect(result)
				.toEqual({ value: 1n })
		})

		it('should pass for zero bigint', () => {
			const result = v.bigint()
				.execute(0n)
			expect(result)
				.toEqual({ value: 0n })
		})

		it('should pass for negative bigint', () => {
			const result = v.bigint()
				.execute(-1n)
			expect(result)
				.toEqual({ value: -1n })
		})

		it('should pass for large bigint', () => {
			const largeBigint = 123456789012345678901234567890n
			const result = v.bigint()
				.execute(largeBigint)
			expect(result)
				.toEqual({ value: largeBigint })
		})
	})

	describe('invalid inputs', () => {
		it('should fail for number', () => {
			const result = v.bigint()
				.execute(42)
			expect(result)
				.toEqual({
					issues: [{
						code: 'bigint:expected_bigint',
						message: 'Expected a bigint.',
						path: [],
						payload: { value: 42 },
					}],
				})
		})

		it('should fail for string', () => {
			const result = v.bigint()
				.execute('hello')
			expect(result)
				.toEqual({
					issues: [{
						code: 'bigint:expected_bigint',
						message: 'Expected a bigint.',
						path: [],
						payload: { value: 'hello' },
					}],
				})
		})

		it('should fail for boolean', () => {
			const result = v.bigint()
				.execute(true)
			expect(result)
				.toEqual({
					issues: [{
						code: 'bigint:expected_bigint',
						message: 'Expected a bigint.',
						path: [],
						payload: { value: true },
					}],
				})
		})

		it('should fail for null', () => {
			const result = v.bigint()
				.execute(null)
			expect(result)
				.toEqual({
					issues: [{
						code: 'bigint:expected_bigint',
						message: 'Expected a bigint.',
						path: [],
						payload: { value: null },
					}],
				})
		})

		it('should fail for undefined', () => {
			const result = v.bigint()
				.execute(undefined)
			expect(result)
				.toEqual({
					issues: [{
						code: 'bigint:expected_bigint',
						message: 'Expected a bigint.',
						path: [],
						payload: { value: undefined },
					}],
				})
		})

		it('should fail for object', () => {
			const result = v.bigint()
				.execute({})
			expect(result)
				.toEqual({
					issues: [{
						code: 'bigint:expected_bigint',
						message: 'Expected a bigint.',
						path: [],
						payload: { value: {} },
					}],
				})
		})

		it('should fail for array', () => {
			const result = v.bigint()
				.execute([])
			expect(result)
				.toEqual({
					issues: [{
						code: 'bigint:expected_bigint',
						message: 'Expected a bigint.',
						path: [],
						payload: { value: [] },
					}],
				})
		})

		it('should fail for symbol', () => {
			const sym = Symbol('test')
			const result = v.bigint()
				.execute(sym)
			expect(result)
				.toEqual({
					issues: [{
						code: 'bigint:expected_bigint',
						message: 'Expected a bigint.',
						path: [],
						payload: { value: sym },
					}],
				})
		})
	})

	describe('custom messages', () => {
		it('should use custom message for invalid input', () => {
			const result = v.bigint('Custom error message')
				.execute(42)
			expect(result)
				.toEqual({
					issues: [{
						code: 'bigint:expected_bigint',
						message: 'Custom error message',
						path: [],
						payload: { value: 42 },
					}],
				})
		})
	})

	describe('chaining', () => {
		it('should chain with min', () => {
			const result = v.bigint()
				.min(5n)
				.execute(10n)
			expect(result)
				.toEqual({ value: 10n })
		})

		it('should fail chaining with min', () => {
			const result = v.bigint()
				.min(5n)
				.execute(3n)
			expect(result)
				.toEqual({
					issues: [{
						code: 'min:expected_min',
						message: 'Expected a minimum value of 5.',
						path: [],
						payload: { target: 'bigint', value: 3n, min: 5n },
					}],
				})
		})
	})
})
