/**
 * Test plan for undefined step:
 * - Functions tested: undefined validation with optional custom messages.
 * - Valid inputs: undefined.
 * - Invalid inputs: non-undefined types (number, string, boolean, null, object, array, bigint, symbol).
 * - Edge cases: none specific.
 * - Expected behaviors: Success returns { value: undefined }; failure returns { issues: [{ code: 'undefined:expected_undefined', payload: { value }, message }] }.
 * - Error handling: No exceptions; all errors via issues.
 * - Coverage goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { check, createValchecker, undefined_ } from '../..'

const v = createValchecker({ steps: [undefined_, check] })

describe('undefined plugin', () => {
	describe('valid inputs', () => {
		it('should pass for undefined', () => {
			const result = v.undefined()
				.execute(undefined)
			expect(result)
				.toEqual({ value: undefined })
		})
	})

	describe('invalid inputs', () => {
		it('should fail for number', () => {
			const result = v.undefined()
				.execute(42)
			expect(result)
				.toEqual({
					issues: [{
						code: 'undefined:expected_undefined',
						payload: { value: 42 },
						message: 'Expected undefined.',
					}],
				})
		})

		it('should fail for string', () => {
			const result = v.undefined()
				.execute('hello')
			expect(result)
				.toEqual({
					issues: [{
						code: 'undefined:expected_undefined',
						payload: { value: 'hello' },
						message: 'Expected undefined.',
					}],
				})
		})

		it('should fail for boolean', () => {
			const result = v.undefined()
				.execute(true)
			expect(result)
				.toEqual({
					issues: [{
						code: 'undefined:expected_undefined',
						payload: { value: true },
						message: 'Expected undefined.',
					}],
				})
		})

		it('should fail for null', () => {
			const result = v.undefined()
				.execute(null)
			expect(result)
				.toEqual({
					issues: [{
						code: 'undefined:expected_undefined',
						payload: { value: null },
						message: 'Expected undefined.',
					}],
				})
		})

		it('should fail for object', () => {
			const result = v.undefined()
				.execute({})
			expect(result)
				.toEqual({
					issues: [{
						code: 'undefined:expected_undefined',
						payload: { value: {} },
						message: 'Expected undefined.',
					}],
				})
		})

		it('should fail for array', () => {
			const result = v.undefined()
				.execute([])
			expect(result)
				.toEqual({
					issues: [{
						code: 'undefined:expected_undefined',
						payload: { value: [] },
						message: 'Expected undefined.',
					}],
				})
		})

		it('should fail for bigint', () => {
			const result = v.undefined()
				.execute(123n)
			expect(result)
				.toEqual({
					issues: [{
						code: 'undefined:expected_undefined',
						payload: { value: 123n },
						message: 'Expected undefined.',
					}],
				})
		})

		it('should fail for symbol', () => {
			const sym = Symbol('test')
			const result = v.undefined()
				.execute(sym)
			expect(result)
				.toEqual({
					issues: [{
						code: 'undefined:expected_undefined',
						payload: { value: sym },
						message: 'Expected undefined.',
					}],
				})
		})
	})

	describe('custom messages', () => {
		it('should use custom message for invalid input', () => {
			const result = v.undefined('Custom error message')
				.execute(42)
			expect(result)
				.toEqual({
					issues: [{
						code: 'undefined:expected_undefined',
						payload: { value: 42 },
						message: 'Custom error message',
					}],
				})
		})
	})

	describe('chaining', () => {
		it('should chain with check', () => {
			const result = v.undefined()
				.check(u => u === undefined)
				.execute(undefined)
			expect(result)
				.toEqual({ value: undefined })
		})

		it('should fail chaining with check', () => {
			const result = v.undefined()
				.check(u => u !== undefined)
				.execute(undefined)
			expect(result)
				.toEqual({
					issues: [{
						code: 'check:failed',
						payload: { value: undefined },
						message: 'Check failed',
					}],
				})
		})
	})
})
