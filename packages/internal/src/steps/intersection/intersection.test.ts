/**
 * Test plan for intersection step:
 * - Functions tested: intersection validation (passes all provided branches).
 * - Valid inputs: value passes all branches, async branches.
 * - Invalid inputs: value fails one branch, value fails multiple branches, async failure.
 * - Edge cases: none specific.
 * - Expected behaviors: Success returns { value: input }; failure returns issues from failed branches.
 * - Error handling: No exceptions; all errors via issues.
 * - Coverage goals: 100% statement, branch, and function coverage.
 */

import { describe, expect, it } from 'vitest'
import { createValchecker, intersection, number, string, transform } from '../..'

const v = createValchecker({ steps: [intersection, string, number, transform] })

describe('intersection plugin', () => {
	describe('valid inputs', () => {
		it('should pass when value passes all branches', () => {
			const result = v.intersection([
				v.string().transform(x => x),
				v.string().transform(x => x),
			]).execute('hello')
			expect(result).toEqual({ value: 'hello' })
		})

		it('should handle async branches', async () => {
			const result = await v.intersection([
				v.string().transform(async _x => _x),
				v.string().transform(async _x => _x),
			]).execute('hello')
			expect(result).toEqual({ value: 'hello' })
		})

		it('should handle async branches with multiple branches (triggers chaining)', async () => {
			const result = await v.intersection([
				v.string().transform(async x => x),
				v.string().transform(async x => x),
				v.string().transform(async x => x),
			]).execute('hello')
			expect(result).toEqual({ value: 'hello' })
		})

		it('should handle async failure in chain', async () => {
			const result = await v.intersection([
				v.string().transform(async x => x),
				v.string().transform(async x => x),
				v.string().transform(async (_x) => { throw new Error('fail') }),
			]).execute('hello')
			expect(result).toEqual({
				issues: [{
					code: 'transform:failed',
					payload: { value: 'hello', error: new Error('fail') },
					message: 'Transform failed',
				}],
			})
		})

		it('should handle mixed async and sync branches in chain', async () => {
			let firstBranch = true
			const result = await v.intersection([
				v.string().transform(x => firstBranch ? (firstBranch = false, Promise.resolve(x)) : x),
				v.string(),
				v.string(),
			]).execute('hello')
			expect(result).toEqual({ value: 'hello' })
		})
	})

	describe('invalid inputs', () => {
		it('should fail when value fails one branch', () => {
			const result = v.intersection([
				v.string(),
				v.number(),
			]).execute('hello')
			expect(result).toEqual({
				issues: [{
					code: 'number:expected_number',
					payload: { value: 'hello' },
					message: 'Expected a number (NaN is not allowed).',
				}],
			})
		})

		it('should fail when value fails multiple branches', () => {
			const result = v.intersection([
				v.string(),
				v.number(),
			]).execute(null)
			expect(result).toEqual({
				issues: [{
					code: 'string:expected_string',
					payload: { value: null },
					message: 'Expected a string.',
				}],
			})
		})

		it('should handle async failure', async () => {
			const result = await v.intersection([
				v.string().transform(async _x => _x),
				v.string().transform(async (_x) => { throw new Error('fail') }),
			]).execute('hello')
			expect(result).toEqual({
				issues: [{
					code: 'transform:failed',
					payload: { value: 'hello', error: new Error('fail') },
					message: 'Transform failed',
				}],
			})
		})
	})
})
