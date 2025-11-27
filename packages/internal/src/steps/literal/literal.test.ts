/**
 * Test Plan for literal.test.ts
 *
 * This file tests the literal step plugin implementation in literal.ts.
 *
 * Functions to test:
 * - literal: The step plugin that checks if the input value matches the specified literal value.
 *
 * Test cases:
 * - Valid inputs: Matching literal values (string, number, boolean, bigint, symbol) should pass and return the value.
 * - Invalid inputs: Non-matching values should fail with 'literal:expected_literal' issue.
 * - Edge cases: Empty string, zero, negative numbers, symbols with descriptions.
 * - Custom messages: Using custom message handler to override default message.
 * - Chaining: Chaining with check step to add additional validation.
 *
 * Coverage goals: Achieve 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { check, createValchecker, literal } from '../..'

const v = createValchecker({ steps: [literal, check] })

describe('literal step plugin', () => {
	describe('valid inputs', () => {
		it('should pass for matching string', () => {
			const result = v.literal('hello')
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should pass for matching number', () => {
			const result = v.literal(42)
				.execute(42)
			expect(result)
				.toEqual({ value: 42 })
		})

		it('should pass for matching boolean true', () => {
			const result = v.literal(true)
				.execute(true)
			expect(result)
				.toEqual({ value: true })
		})

		it('should pass for matching boolean false', () => {
			const result = v.literal(false)
				.execute(false)
			expect(result)
				.toEqual({ value: false })
		})

		it('should pass for matching bigint', () => {
			const result = v.literal(123n)
				.execute(123n)
			expect(result)
				.toEqual({ value: 123n })
		})

		it('should pass for matching symbol', () => {
			const sym = Symbol('test')
			const result = v.literal(sym)
				.execute(sym)
			expect(result)
				.toEqual({ value: sym })
		})
	})

	describe('invalid inputs', () => {
		it('should fail for different string', () => {
			const result = v.literal('hello')
				.execute('world')
			expect(result)
				.toEqual({
					issues: [{
						code: 'literal:expected_literal',
						message: 'Expected literal value "hello".',
						path: [],
						payload: { value: 'world', expected: 'hello' },
					}],
				})
		})

		it('should fail for different number', () => {
			const result = v.literal(42)
				.execute(43)
			expect(result)
				.toEqual({
					issues: [{
						code: 'literal:expected_literal',
						message: 'Expected literal value "42".',
						path: [],
						payload: { value: 43, expected: 42 },
					}],
				})
		})

		it('should fail for different boolean', () => {
			const result = v.literal(true)
				.execute(false)
			expect(result)
				.toEqual({
					issues: [{
						code: 'literal:expected_literal',
						message: 'Expected literal value "true".',
						path: [],
						payload: { value: false, expected: true },
					}],
				})
		})

		it('should fail for different bigint', () => {
			const result = v.literal(123n)
				.execute(124n)
			expect(result)
				.toEqual({
					issues: [{
						code: 'literal:expected_literal',
						message: 'Expected literal value "123".',
						path: [],
						payload: { value: 124n, expected: 123n },
					}],
				})
		})

		it('should fail for different symbol', () => {
			const sym1 = Symbol('test')
			const sym2 = Symbol('test')
			const result = v.literal(sym1)
				.execute(sym2)
			expect(result)
				.toEqual({
					issues: [{
						code: 'literal:expected_literal',
						message: 'Expected literal value "Symbol(test)".',
						path: [],
						payload: { value: sym2, expected: sym1 },
					}],
				})
		})

		it('should fail for wrong type', () => {
			const result = v.literal('hello')
				.execute(42)
			expect(result)
				.toEqual({
					issues: [{
						code: 'literal:expected_literal',
						message: 'Expected literal value "hello".',
						path: [],
						payload: { value: 42, expected: 'hello' },
					}],
				})
		})
	})

	describe('edge cases', () => {
		it('should pass for empty string', () => {
			const result = v.literal('')
				.execute('')
			expect(result)
				.toEqual({ value: '' })
		})

		it('should pass for zero', () => {
			const result = v.literal(0)
				.execute(0)
			expect(result)
				.toEqual({ value: 0 })
		})

		it('should pass for negative number', () => {
			const result = v.literal(-1)
				.execute(-1)
			expect(result)
				.toEqual({ value: -1 })
		})

		it('should fail for empty string vs non-empty', () => {
			const result = v.literal('')
				.execute('a')
			expect(result)
				.toEqual({
					issues: [{
						code: 'literal:expected_literal',
						message: 'Expected literal value "".',
						path: [],
						payload: { value: 'a', expected: '' },
					}],
				})
		})

		it('should fail for zero vs one', () => {
			const result = v.literal(0)
				.execute(1)
			expect(result)
				.toEqual({
					issues: [{
						code: 'literal:expected_literal',
						message: 'Expected literal value "0".',
						path: [],
						payload: { value: 1, expected: 0 },
					}],
				})
		})
	})

	describe('custom messages', () => {
		it('should use custom message for invalid input', () => {
			const result = v.literal('hello', () => 'Custom error message')
				.execute('world')
			expect(result)
				.toEqual({
					issues: [{
						code: 'literal:expected_literal',
						message: 'Custom error message',
						path: [],
						payload: { value: 'world', expected: 'hello' },
					}],
				})
		})
	})

	describe('chaining', () => {
		it('should chain with check step', () => {
			const result = v.literal('hello')
				.check(v => v.length > 3)
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should fail chaining when check fails', () => {
			const result = v.literal('hi')
				.check(v => v.length > 3)
				.execute('hi')
			expect(result)
				.toEqual({
					issues: [{
						code: 'check:failed',
						message: 'Check failed',
						path: [],
						payload: { value: 'hi' },
					}],
				})
		})
	})
})
