/**
 * Test plan for null step:
 * - Functions tested: null validation with optional custom messages.
 * - Valid inputs: null.
 * - Invalid inputs: non-null types (number, string, boolean, undefined, object, array, bigint, symbol).
 * - Edge cases: none specific.
 * - Expected behaviors: Success returns { value: null }; failure returns { issues: [{ code: 'null:expected_null', payload: { value }, message }] }.
 * - Error handling: No exceptions; all errors via issues.
 * - Coverage goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { check, createValchecker, null_ } from '../..'

const v = createValchecker({ steps: [null_, check] })

describe('null plugin', () => {
	describe('valid inputs', () => {
		it('should pass for null', () => {
			const result = v.null()
				.execute(null)
			expect(result)
				.toEqual({ value: null })
		})
	})

	describe('invalid inputs', () => {
		it('should fail for number', () => {
			const result = v.null()
				.execute(42)
			expect(result)
				.toEqual({
					issues: [{
						code: 'null:expected_null',
						message: 'Expected null.',
						path: [],
						payload: { value: 42 },
					}],
				})
		})

		it('should fail for string', () => {
			const result = v.null()
				.execute('hello')
			expect(result)
				.toEqual({
					issues: [{
						code: 'null:expected_null',
						message: 'Expected null.',
						path: [],
						payload: { value: 'hello' },
					}],
				})
		})

		it('should fail for boolean', () => {
			const result = v.null()
				.execute(true)
			expect(result)
				.toEqual({
					issues: [{
						code: 'null:expected_null',
						message: 'Expected null.',
						path: [],
						payload: { value: true },
					}],
				})
		})

		it('should fail for undefined', () => {
			const result = v.null()
				.execute(undefined)
			expect(result)
				.toEqual({
					issues: [{
						code: 'null:expected_null',
						message: 'Expected null.',
						path: [],
						payload: { value: undefined },
					}],
				})
		})

		it('should fail for object', () => {
			const result = v.null()
				.execute({})
			expect(result)
				.toEqual({
					issues: [{
						code: 'null:expected_null',
						message: 'Expected null.',
						path: [],
						payload: { value: {} },
					}],
				})
		})

		it('should fail for array', () => {
			const result = v.null()
				.execute([])
			expect(result)
				.toEqual({
					issues: [{
						code: 'null:expected_null',
						message: 'Expected null.',
						path: [],
						payload: { value: [] },
					}],
				})
		})

		it('should fail for bigint', () => {
			const result = v.null()
				.execute(123n)
			expect(result)
				.toEqual({
					issues: [{
						code: 'null:expected_null',
						message: 'Expected null.',
						path: [],
						payload: { value: 123n },
					}],
				})
		})

		it('should fail for symbol', () => {
			const sym = Symbol('test')
			const result = v.null()
				.execute(sym)
			expect(result)
				.toEqual({
					issues: [{
						code: 'null:expected_null',
						message: 'Expected null.',
						path: [],
						payload: { value: sym },
					}],
				})
		})
	})

	describe('custom messages', () => {
		it('should use custom message for invalid input', () => {
			const result = v.null('Custom error message')
				.execute(42)
			expect(result)
				.toEqual({
					issues: [{
						code: 'null:expected_null',
						message: 'Custom error message',
						path: [],
						payload: { value: 42 },
					}],
				})
		})
	})

	describe('chaining', () => {
		it('should chain with check', () => {
			const result = v.null()
				.check(n => n === null)
				.execute(null)
			expect(result)
				.toEqual({ value: null })
		})

		it('should fail chaining with check', () => {
			const result = v.null()
				.check(n => n !== null)
				.execute(null)
			expect(result)
				.toEqual({
					issues: [{
						code: 'check:failed',
						message: 'Check failed',
						path: [],
						payload: { value: null },
					}],
				})
		})
	})
})
