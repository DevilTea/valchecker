/**
 * Test plan for union step:
 * - Functions tested: union validation (matches at least one of the provided branches).
 * - Valid inputs: value matches any branch, value matches multiple branches, async branches.
 * - Invalid inputs: value matches no branches, async failure.
 * - Edge cases: single branch union.
 * - Expected behaviors: Success returns { value: input }; failure returns issues from all failed branches.
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

		it('should pass when value matches second branch', () => {
			const result = v.union([v.string(), v.number()])
				.execute(42)
			expect(result)
				.toEqual({ value: 42 })
		})

		it('should pass when value matches later branch', () => {
			const result = v.union([v.number(), v.string()])
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should pass when value matches multiple branches', () => {
			const result = v.union([v.string(), v.string()])
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should handle async branches', async () => {
			const result = await v.union([
				v.string()
					.transform(async x => x.toUpperCase()),
				v.number(),
			])
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should handle async branches with multiple branches (triggers chaining)', async () => {
			const result = await v.union([
				v.number(),
				v.string()
					.transform(async x => x.toUpperCase()),
				v.string(),
			])
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should handle async failure with chaining', async () => {
			const result = await v.union([
				v.number(),
				v.string()
					.transform(async (_x) => { throw new Error('fail') }),
				v.string(),
			])
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should handle mixed async and sync branches in chain', async () => {
			let firstFail = true
			const result = await v.union([
				v.number(),
				v.string()
					.transform(x => firstFail ? (firstFail = false, Promise.reject(new Error('fail'))) : x),
				v.string(),
			])
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should handle async failure when no branch matches', async () => {
			const result = await v.union([
				v.number(),
				v.string()
					.transform(async (_x) => { throw new Error('fail') }),
				v.number(),
			])
				.execute('hello')
			expect(result)
				.toEqual({
					issues: [
						{
							code: 'number:expected_number',
							message: 'Expected a number (NaN is not allowed).',
							path: [],
							payload: { value: 'hello' },
						},
						{
							code: 'transform:failed',
							message: 'Transform failed',
							path: [],
							payload: { value: 'hello', error: new Error('fail') },
						},
						{
							code: 'number:expected_number',
							message: 'Expected a number (NaN is not allowed).',
							path: [],
							payload: { value: 'hello' },
						},
					],
				})
		})
	})

	describe('invalid unions (matches no branches)', () => {
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

		it('should collect issues from all branches', () => {
			const result = v.union([v.string(), v.number()])
				.execute({})
			expect(result)
				.toEqual({
					issues: [
						{
							code: 'string:expected_string',
							message: 'Expected a string.',
							path: [],
							payload: { value: {} },
						},
						{
							code: 'number:expected_number',
							message: 'Expected a number (NaN is not allowed).',
							path: [],
							payload: { value: {} },
						},
					],
				})
		})

		it('should handle async failure', async () => {
			const result = await v.union([
				v.string()
					.transform(async (_x) => { throw new Error('fail') }),
				v.number(),
			])
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
	})

	describe('edge cases', () => {
		it('should handle single branch union', () => {
			const result = v.union([v.string()])
				.execute('hello')
			expect(result)
				.toEqual({ value: 'hello' })
		})

		it('should fail for single branch union with invalid input', () => {
			const result = v.union([v.string()])
				.execute(42)
			expect(result)
				.toEqual({
					issues: [{
						code: 'string:expected_string',
						message: 'Expected a string.',
						path: [],
						payload: { value: 42 },
					}],
				})
		})
	})
})
