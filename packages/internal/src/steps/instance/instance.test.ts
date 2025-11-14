/**
 * Test Plan for instance.test.ts
 *
 * This file tests the instance step plugin implementation in instance.ts.
 *
 * Functions to test:
 * - instance: The step plugin that checks if the value is an instance of a class.
 *
 * Test cases:
 * - Valid inputs: Value is an instance of the specified class.
 * - Invalid inputs: Value is not an instance of the class, fails with 'instance:expected_instance'.
 * - Edge cases: null, undefined, primitive types, instances of other classes.
 * - Custom messages: Using custom message handler to override default message.
 * - Chaining: Chaining with check step to add additional validation.
 *
 * Coverage goals: Achieve 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { check, createValchecker, instance } from '../..'

const v = createValchecker({ steps: [instance, check] })

describe('instance step plugin', () => {
	describe('valid inputs', () => {
		it('should pass when value is instance of Date', () => {
			const result = v.instance(Date).execute(new Date())
			expect(result).toEqual({ value: expect.any(Date) })
		})

		it('should pass when value is instance of Array', () => {
			const result = v.instance(Array).execute([1, 2, 3])
			expect(result).toEqual({ value: [1, 2, 3] })
		})

		it('should pass when value is instance of custom class', () => {
			class CustomClass {}
			const instance_ = new CustomClass()
			const result = v.instance(CustomClass).execute(instance_)
			expect(result).toEqual({ value: instance_ })
		})
	})

	describe('invalid inputs', () => {
		it('should fail when value is not instance of the class', () => {
			const result = v.instance(Date).execute('not a date')
			expect(result).toEqual({
				issues: [{
					code: 'instance:expected_instance',
					payload: { value: 'not a date', expected: Date },
					message: 'Expected instance of Date.',
				}],
			})
		})

		it('should fail when value is null', () => {
			const result = v.instance(Date).execute(null)
			expect(result).toEqual({
				issues: [{
					code: 'instance:expected_instance',
					payload: { value: null, expected: Date },
					message: 'Expected instance of Date.',
				}],
			})
		})

		it('should fail when value is undefined', () => {
			const result = v.instance(Date).execute(undefined)
			expect(result).toEqual({
				issues: [{
					code: 'instance:expected_instance',
					payload: { value: undefined, expected: Date },
					message: 'Expected instance of Date.',
				}],
			})
		})

		it('should fail when value is number', () => {
			const result = v.instance(Date).execute(42)
			expect(result).toEqual({
				issues: [{
					code: 'instance:expected_instance',
					payload: { value: 42, expected: Date },
					message: 'Expected instance of Date.',
				}],
			})
		})

		it('should fail when value is instance of different class', () => {
			const result = v.instance(Date).execute([])
			expect(result).toEqual({
				issues: [{
					code: 'instance:expected_instance',
					payload: { value: [], expected: Date },
					message: 'Expected instance of Date.',
				}],
			})
		})
	})

	describe('edge cases', () => {
		it('should fail for primitive string', () => {
			const result = v.instance(String).execute('hello')
			expect(result).toEqual({
				issues: [{
					code: 'instance:expected_instance',
					payload: { value: 'hello', expected: String },
					message: 'Expected instance of String.',
				}],
			})
		})

		it('should fail for primitive number', () => {
			const result = v.instance(Number).execute(42)
			expect(result).toEqual({
				issues: [{
					code: 'instance:expected_instance',
					payload: { value: 42, expected: Number },
					message: 'Expected instance of Number.',
				}],
			})
		})
	})

	describe('custom messages', () => {
		it('should use custom message handler', () => {
			const result = v.instance(
				Date,
				() => 'Custom error message',
			).execute('not a date')
			expect(result).toEqual({
				issues: [{
					code: 'instance:expected_instance',
					payload: { value: 'not a date', expected: Date },
					message: 'Custom error message',
				}],
			})
		})
	})

	describe('chaining', () => {
		it('should chain with check step', () => {
			const date = new Date()
			const result = v.instance(Date)
				.check(d => d.getTime() > 0)
				.execute(date)
			expect(result).toEqual({ value: date })
		})

		it('should fail chaining when check fails', () => {
			const result = v.instance(Date)
				.check(() => false)
				.execute(new Date())
			expect(result).toEqual({
				issues: [{
					code: 'check:failed',
					payload: { value: expect.any(Date) },
					message: 'Check failed',
				}],
			})
		})
	})
})
