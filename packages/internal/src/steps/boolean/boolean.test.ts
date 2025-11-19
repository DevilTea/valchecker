/**
 * Test plan for boolean step:
 * - Functions tested: boolean validation with optional custom messages.
 * - Valid inputs: true and false.
 * - Invalid inputs: non-boolean types (number, string, null, undefined, object, array, bigint, symbol).
 * - Edge cases: none specific beyond true/false.
 * - Expected behaviors: Success returns { value: boolean }; failure returns { issues: [{ code: 'boolean:expected_boolean', payload: { value }, message }] }.
 * - Error handling: No exceptions; all errors via issues.
 * - Coverage goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { boolean, check, createValchecker } from '../..'

const v = createValchecker({ steps: [boolean, check] })

describe('boolean plugin', () => {
	describe('valid inputs', () => {
		it('should pass for true', () => {
			const result = v.boolean()
				.execute(true)
			expect(result)
				.toEqual({ value: true })
		})

		it('should pass for false', () => {
			const result = v.boolean()
				.execute(false)
			expect(result)
				.toEqual({ value: false })
		})
	})

	describe('invalid inputs', () => {
		it('should fail for number', () => {
			const result = v.boolean()
				.execute(42)
			expect(result)
				.toEqual({
					issues: [{
						code: 'boolean:expected_boolean',
						payload: { value: 42 },
						message: 'Expected a boolean.',
					}],
				})
		})

		it('should fail for string', () => {
			const result = v.boolean()
				.execute('hello')
			expect(result)
				.toEqual({
					issues: [{
						code: 'boolean:expected_boolean',
						payload: { value: 'hello' },
						message: 'Expected a boolean.',
					}],
				})
		})

		it('should fail for null', () => {
			const result = v.boolean()
				.execute(null)
			expect(result)
				.toEqual({
					issues: [{
						code: 'boolean:expected_boolean',
						payload: { value: null },
						message: 'Expected a boolean.',
					}],
				})
		})

		it('should fail for undefined', () => {
			const result = v.boolean()
				.execute(undefined)
			expect(result)
				.toEqual({
					issues: [{
						code: 'boolean:expected_boolean',
						payload: { value: undefined },
						message: 'Expected a boolean.',
					}],
				})
		})

		it('should fail for object', () => {
			const result = v.boolean()
				.execute({})
			expect(result)
				.toEqual({
					issues: [{
						code: 'boolean:expected_boolean',
						payload: { value: {} },
						message: 'Expected a boolean.',
					}],
				})
		})

		it('should fail for array', () => {
			const result = v.boolean()
				.execute([])
			expect(result)
				.toEqual({
					issues: [{
						code: 'boolean:expected_boolean',
						payload: { value: [] },
						message: 'Expected a boolean.',
					}],
				})
		})

		it('should fail for bigint', () => {
			const result = v.boolean()
				.execute(123n)
			expect(result)
				.toEqual({
					issues: [{
						code: 'boolean:expected_boolean',
						payload: { value: 123n },
						message: 'Expected a boolean.',
					}],
				})
		})

		it('should fail for symbol', () => {
			const sym = Symbol('test')
			const result = v.boolean()
				.execute(sym)
			expect(result)
				.toEqual({
					issues: [{
						code: 'boolean:expected_boolean',
						payload: { value: sym },
						message: 'Expected a boolean.',
					}],
				})
		})
	})

	describe('custom messages', () => {
		it('should use custom message for invalid input', () => {
			const result = v.boolean('Custom error message')
				.execute(42)
			expect(result)
				.toEqual({
					issues: [{
						code: 'boolean:expected_boolean',
						payload: { value: 42 },
						message: 'Custom error message',
					}],
				})
		})
	})

	describe('chaining', () => {
		it('should chain with check', () => {
			const result = v.boolean()
				.check(x => x === true)
				.execute(true)
			expect(result)
				.toEqual({ value: true })
		})

		it('should fail chaining with check', () => {
			const result = v.boolean()
				.check(x => x === true)
				.execute(false)
			expect(result)
				.toEqual({
					issues: [{
						code: 'check:failed',
						payload: { value: false },
						message: 'Check failed',
					}],
				})
		})
	})
})
