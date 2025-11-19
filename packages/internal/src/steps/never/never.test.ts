/**
 * Test Plan for never.test.ts
 *
 * This file tests the never step plugin implementation in never.ts.
 *
 * Functions to test:
 * - never: The step plugin that always fails for any value.
 *
 * Test cases:
 * - Valid inputs: None, as never always fails.
 * - Invalid inputs: All inputs should fail with 'never:expected_never' issue.
 *   - number: 42
 *   - string: 'hello'
 *   - boolean: true, false
 *   - null
 *   - undefined
 *   - object: {}, { key: 'value' }
 *   - array: [], [1, 2, 3]
 *   - bigint: 123n
 *   - symbol: Symbol('test')
 *   - zero: 0
 *   - empty string: ''
 * - Edge cases: Various types including empty structures.
 * - Custom messages: Not supported for never step.
 * - Chaining: Not supported for never step.
 *
 * Coverage goals: Achieve 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { createValchecker, never } from '../..'

const v = createValchecker({ steps: [never] })

describe('never step plugin', () => {
	describe('invalid inputs', () => {
		it('should fail for number', () => {
			const result = v.never()
				.execute(42)
			expect(result)
				.toEqual({
					issues: [{
						code: 'never:expected_never',
						message: 'Expected never.',
						payload: { value: 42 },
					}],
				})
		})

		it('should fail for string', () => {
			const result = v.never()
				.execute('hello')
			expect(result)
				.toEqual({
					issues: [{
						code: 'never:expected_never',
						message: 'Expected never.',
						payload: { value: 'hello' },
					}],
				})
		})

		it('should fail for boolean true', () => {
			const result = v.never()
				.execute(true)
			expect(result)
				.toEqual({
					issues: [{
						code: 'never:expected_never',
						message: 'Expected never.',
						payload: { value: true },
					}],
				})
		})

		it('should fail for boolean false', () => {
			const result = v.never()
				.execute(false)
			expect(result)
				.toEqual({
					issues: [{
						code: 'never:expected_never',
						message: 'Expected never.',
						payload: { value: false },
					}],
				})
		})

		it('should fail for null', () => {
			const result = v.never()
				.execute(null)
			expect(result)
				.toEqual({
					issues: [{
						code: 'never:expected_never',
						message: 'Expected never.',
						payload: { value: null },
					}],
				})
		})

		it('should fail for undefined', () => {
			const result = v.never()
				.execute(undefined)
			expect(result)
				.toEqual({
					issues: [{
						code: 'never:expected_never',
						message: 'Expected never.',
						payload: { value: undefined },
					}],
				})
		})

		it('should fail for object', () => {
			const obj = { key: 'value' }
			const result = v.never()
				.execute(obj)
			expect(result)
				.toEqual({
					issues: [{
						code: 'never:expected_never',
						message: 'Expected never.',
						payload: { value: obj },
					}],
				})
		})

		it('should fail for array', () => {
			const arr = [1, 2, 3]
			const result = v.never()
				.execute(arr)
			expect(result)
				.toEqual({
					issues: [{
						code: 'never:expected_never',
						message: 'Expected never.',
						payload: { value: arr },
					}],
				})
		})

		it('should fail for bigint', () => {
			const result = v.never()
				.execute(123n)
			expect(result)
				.toEqual({
					issues: [{
						code: 'never:expected_never',
						message: 'Expected never.',
						payload: { value: 123n },
					}],
				})
		})

		it('should fail for symbol', () => {
			const sym = Symbol('test')
			const result = v.never()
				.execute(sym)
			expect(result)
				.toEqual({
					issues: [{
						code: 'never:expected_never',
						message: 'Expected never.',
						payload: { value: sym },
					}],
				})
		})
	})

	describe('edge cases', () => {
		it('should fail for empty object', () => {
			const result = v.never()
				.execute({})
			expect(result)
				.toEqual({
					issues: [{
						code: 'never:expected_never',
						message: 'Expected never.',
						payload: { value: {} },
					}],
				})
		})

		it('should fail for empty array', () => {
			const result = v.never()
				.execute([])
			expect(result)
				.toEqual({
					issues: [{
						code: 'never:expected_never',
						message: 'Expected never.',
						payload: { value: [] },
					}],
				})
		})

		it('should fail for zero', () => {
			const result = v.never()
				.execute(0)
			expect(result)
				.toEqual({
					issues: [{
						code: 'never:expected_never',
						message: 'Expected never.',
						payload: { value: 0 },
					}],
				})
		})

		it('should fail for empty string', () => {
			const result = v.never()
				.execute('')
			expect(result)
				.toEqual({
					issues: [{
						code: 'never:expected_never',
						message: 'Expected never.',
						payload: { value: '' },
					}],
				})
		})

		it('should fail for function', () => {
			const func = () => 'test'
			const result = v.never()
				.execute(func)
			expect(result)
				.toEqual({
					issues: [{
						code: 'never:expected_never',
						message: 'Expected never.',
						payload: { value: func },
					}],
				})
		})
	})

	describe('custom messages', () => {
		it('should use custom message', () => {
			const result = v.never('Custom message')
				.execute(42)
			expect(result)
				.toEqual({
					issues: [{
						code: 'never:expected_never',
						message: 'Custom message',
						payload: { value: 42 },
					}],
				})
		})
	})
})
