/**
 * Test plan for string step:
 * - Functions tested: string validation with optional custom messages.
 * - Valid inputs: strings of any length.
 * - Invalid inputs: non-string types (number, boolean, null, undefined, object, array, bigint, symbol).
 * - Edge cases: empty string, unicode strings.
 * - Expected behaviors: Success returns { value: string }; failure returns { issues: [{ code: 'string:expected_string', payload: { value }, message }] }.
 * - Error handling: No exceptions; all errors via issues.
 * - Coverage goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { createValchecker, min, string } from '../..'

const v = createValchecker({ steps: [string, min] })

describe('string plugin', () => {
	describe('valid inputs', () => {
		it('should pass for valid string', () => {
			const result = v.string()
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should pass for empty string', () => {
			const result = v.string()
				.execute('')
			expect(result)
				.toEqual({ value: '' })
		})

		it('should pass for unicode string', () => {
			const result = v.string()
				.execute('你好')
			expect(result)
				.toEqual({ value: '你好' })
		})
	})

	describe('invalid inputs', () => {
		it('should fail for number', () => {
			const result = v.string()
				.execute(123)
			expect(result)
				.toEqual({
					issues: [{
						code: 'string:expected_string',
						message: 'Expected a string.',
						path: [],
						payload: { value: 123 },
					}],
				})
		})

		it('should fail for boolean', () => {
			const result = v.string()
				.execute(true)
			expect(result)
				.toEqual({
					issues: [{
						code: 'string:expected_string',
						message: 'Expected a string.',
						path: [],
						payload: { value: true },
					}],
				})
		})

		it('should fail for null', () => {
			const result = v.string()
				.execute(null)
			expect(result)
				.toEqual({
					issues: [{
						code: 'string:expected_string',
						message: 'Expected a string.',
						path: [],
						payload: { value: null },
					}],
				})
		})

		it('should fail for undefined', () => {
			const result = v.string()
				.execute(undefined)
			expect(result)
				.toEqual({
					issues: [{
						code: 'string:expected_string',
						message: 'Expected a string.',
						path: [],
						payload: { value: undefined },
					}],
				})
		})

		it('should fail for object', () => {
			const result = v.string()
				.execute({})
			expect(result)
				.toEqual({
					issues: [{
						code: 'string:expected_string',
						message: 'Expected a string.',
						path: [],
						payload: { value: {} },
					}],
				})
		})

		it('should fail for array', () => {
			const result = v.string()
				.execute([])
			expect(result)
				.toEqual({
					issues: [{
						code: 'string:expected_string',
						message: 'Expected a string.',
						path: [],
						payload: { value: [] },
					}],
				})
		})

		it('should fail for bigint', () => {
			const result = v.string()
				.execute(123n)
			expect(result)
				.toEqual({
					issues: [{
						code: 'string:expected_string',
						message: 'Expected a string.',
						path: [],
						payload: { value: 123n },
					}],
				})
		})

		it('should fail for symbol', () => {
			const sym = Symbol('test')
			const result = v.string()
				.execute(sym)
			expect(result)
				.toEqual({
					issues: [{
						code: 'string:expected_string',
						message: 'Expected a string.',
						path: [],
						payload: { value: sym },
					}],
				})
		})
	})

	describe('custom messages', () => {
		it('should use custom message for invalid input', () => {
			const result = v.string('Custom error message')
				.execute(123)
			expect(result)
				.toEqual({
					issues: [{
						code: 'string:expected_string',
						message: 'Custom error message',
						path: [],
						payload: { value: 123 },
					}],
				})
		})
	})

	describe('chaining', () => {
		it('should chain with min length', () => {
			const result = v.string()
				.min(5)
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should fail chaining with min length', () => {
			const result = v.string()
				.min(5)
				.execute('hi')
			expect(result)
				.toEqual({
					issues: [{
						code: 'min:expected_min',
						message: 'Expected a minimum length of 5.',
						path: [],
						payload: { value: 'hi', min: 5, target: 'length' },
					}],
				})
		})
	})
})
