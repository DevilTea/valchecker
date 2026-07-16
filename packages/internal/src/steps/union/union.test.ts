/**
 * Test plan for union step:
 * - Functions tested: union validation (matches at least one of the provided branches).
 * - Valid inputs: value matches any branch, transformed branch output, async branches.
 * - Invalid inputs: value matches no branches, async failure.
 * - Edge cases: single branch union.
 * - Expected behaviors: Success returns the first successful branch output; failure returns issues from all failed branches.
 * - Error handling: No exceptions; all errors via issues.
 * - Coverage goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { createValchecker, number, string, transform, union } from '../..'

const v = createValchecker({ steps: [union, string, number, transform] })

describe('union plugin', () => {
	describe('valid inputs', () => {
		it('should pass when value matches first branch', () => {
			const result = v.union([v.string(), v.number()])
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should not execute later branches after a synchronous success', () => {
			let laterBranchCalls = 0
			const result = v.union([
				v.string(),
				v.string()
					.transform((value) => {
						laterBranchCalls++
						return value
					}),
			])
				.execute('hello')

			expect(result)
				.toEqual({ value: 'hello' })
			expect(laterBranchCalls)
				.toBe(0)
		})

		it('should pass when value matches second branch', () => {
			const result = v.union([v.string(), v.number()])
				.execute(42)
			expect(result)
				.toEqual({ value: 42 })
		})

		it('should return a successful branch transform output', () => {
			const result = v.union([
				v.number(),
				v.string()
					.transform(value => value.toUpperCase()),
			])
				.execute('hello')
			expect(result)
				.toEqual({ value: 'HELLO' })
		})

		it('should return async branch transform output', async () => {
			const result = await v.union([
				v.string()
					.transform(async value => value.toUpperCase()),
				v.number(),
			])
				.execute('hello')
			expect(result)
				.toEqual({ value: 'HELLO' })
		})

		it('should continue after async branch failure', async () => {
			const result = await v.union([
				v.number(),
				v.string()
					.transform(async () => { throw new Error('fail') }),
				v.string(),
			])
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})
	})

	describe('invalid unions', () => {
		it('should fail when value matches no branches', () => {
			const result = v.union([v.string(), v.number()])
				.execute(null)
			expect(result)
				.toEqual({
					issues: [
						{
							code: 'string:expected_string',
							message: 'Expected a string.',
							path: [],
							payload: { value: null },
						},
						{
							code: 'number:expected_number',
							message: 'Expected a number (NaN is not allowed).',
							path: [],
							payload: { value: null },
						},
					],
				})
		})

		it('should preserve issue order when an async branch and all later branches fail', async () => {
			const result = await v.union([
				v.string()
					.transform(async () => { throw new Error('fail') }),
				v.number(),
			])
				.execute('hello')

			expect(result)
				.toMatchObject({
					issues: [
						{ code: 'transform:failed' },
						{ code: 'number:expected_number' },
					],
				})
		})
	})

	describe('edge cases', () => {
		it('should handle single branch union', () => {
			const result = v.union([v.string()])
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})
	})
})
