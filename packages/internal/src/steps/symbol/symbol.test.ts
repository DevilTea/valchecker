/**
 * Test plan for symbol step:
 * - Functions tested: symbol validation with optional custom messages.
 * - Valid inputs: symbols (anonymous, with description).
 * - Invalid inputs: non-symbol types (number, string, boolean, null, undefined, object, array, bigint).
 * - Edge cases: none specific.
 * - Expected behaviors: Success returns { value: symbol }; failure returns { issues: [{ code: 'symbol:expected_symbol', payload: { value }, message }] }.
 * - Error handling: No exceptions; all errors via issues.
 * - Coverage goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { check, createValchecker, symbol } from '../..'

const v = createValchecker({ steps: [symbol, check] })

describe('symbol plugin', () => {
	describe('valid inputs', () => {
		it('should pass for anonymous symbol', () => {
			const sym = Symbol('anonymous')
			const result = v.symbol()
				.execute(sym)
			expect(result)
				.toEqual({ value: sym })
		})

		it('should pass for symbol with description', () => {
			const sym = Symbol('test')
			const result = v.symbol()
				.execute(sym)
			expect(result)
				.toEqual({ value: sym })
		})
	})

	describe('invalid inputs', () => {
		it('should fail for number', () => {
			const result = v.symbol()
				.execute(42)
			expect(result)
				.toEqual({
					issues: [{
						code: 'symbol:expected_symbol',
						message: 'Expected a symbol.',
						path: [],
						payload: { value: 42 },
					}],
				})
		})

		it('should fail for string', () => {
			const result = v.symbol()
				.execute('hello')
			expect(result)
				.toEqual({
					issues: [{
						code: 'symbol:expected_symbol',
						message: 'Expected a symbol.',
						path: [],
						payload: { value: 'hello' },
					}],
				})
		})

		it('should fail for boolean', () => {
			const result = v.symbol()
				.execute(true)
			expect(result)
				.toEqual({
					issues: [{
						code: 'symbol:expected_symbol',
						message: 'Expected a symbol.',
						path: [],
						payload: { value: true },
					}],
				})
		})

		it('should fail for null', () => {
			const result = v.symbol()
				.execute(null)
			expect(result)
				.toEqual({
					issues: [{
						code: 'symbol:expected_symbol',
						message: 'Expected a symbol.',
						path: [],
						payload: { value: null },
					}],
				})
		})

		it('should fail for undefined', () => {
			const result = v.symbol()
				.execute(undefined)
			expect(result)
				.toEqual({
					issues: [{
						code: 'symbol:expected_symbol',
						message: 'Expected a symbol.',
						path: [],
						payload: { value: undefined },
					}],
				})
		})

		it('should fail for object', () => {
			const result = v.symbol()
				.execute({})
			expect(result)
				.toEqual({
					issues: [{
						code: 'symbol:expected_symbol',
						message: 'Expected a symbol.',
						path: [],
						payload: { value: {} },
					}],
				})
		})

		it('should fail for array', () => {
			const result = v.symbol()
				.execute([])
			expect(result)
				.toEqual({
					issues: [{
						code: 'symbol:expected_symbol',
						message: 'Expected a symbol.',
						path: [],
						payload: { value: [] },
					}],
				})
		})

		it('should fail for bigint', () => {
			const result = v.symbol()
				.execute(123n)
			expect(result)
				.toEqual({
					issues: [{
						code: 'symbol:expected_symbol',
						message: 'Expected a symbol.',
						path: [],
						payload: { value: 123n },
					}],
				})
		})
	})

	describe('custom messages', () => {
		it('should use custom message for invalid input', () => {
			const result = v.symbol('Custom error message')
				.execute(42)
			expect(result)
				.toEqual({
					issues: [{
						code: 'symbol:expected_symbol',
						message: 'Custom error message',
						path: [],
						payload: { value: 42 },
					}],
				})
		})
	})

	describe('chaining', () => {
		it('should chain with check', () => {
			const sym = Symbol('test')
			const result = v.symbol()
				.check(s => s === sym)
				.execute(sym)
			expect(result)
				.toEqual({ value: sym })
		})

		it('should fail chaining with check', () => {
			const sym1 = Symbol('test1')
			const sym2 = Symbol('test2')
			const result = v.symbol()
				.check(s => s === sym1)
				.execute(sym2)
			expect(result)
				.toEqual({
					issues: [{
						code: 'check:failed',
						message: 'Check failed',
						path: [],
						payload: { value: sym2 },
					}],
				})
		})
	})
})
