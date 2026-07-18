import { describe, expect, it, vi } from 'vitest'
import { implStepPlugin } from '../../core'
import { createValchecker, number, string, transform, union, unknown } from '../..'

const unionFixture = implStepPlugin<any>({
	internalFailure: ({ utils }: any) => {
		utils.addSuccessStep(() => {
			throw new Error('internal failure')
		})
	},
	asyncInternalFailure: ({ utils }: any) => {
		utils.addSuccessStep(async () => {
			throw new Error('async internal failure')
		})
	},
	observe: ({ utils, params: [callback] }: any) => {
		utils.addSuccessStep((value: unknown) => {
			callback(value)
			return utils.success(value)
		})
	},
})

const v = createValchecker({
	steps: [number, string, transform, union, unionFixture, unknown],
})

describe('union step plugin', () => {
	it.each([
		['first', v.union([v.string(), v.number()]), 'hello', 'hello'],
		['later', v.union([v.string(), v.number()]), 42, 42],
		[
			'transformed',
			v.union([
				v.number(),
				v.string().transform(value => value.toUpperCase()),
			]),
			'hello',
			'HELLO',
		],
	] as const)('returns the %s successful branch output', (_case, schema, input, output) => {
		expect(schema.execute(input as never)).toEqual({ value: output })
	})

	it('aggregates recoverable branch issues with stable branch context', () => {
		expect(v.union([v.string(), v.number()]).execute(null)).toEqual({
			issues: [
				{
					code: 'string:expected_string',
					category: 'validation',
					message: 'Expected a string.',
					path: [],
					context: [{ type: 'union', branchIndex: 0 }],
					payload: { value: null },
				},
				{
					code: 'number:expected_number',
					category: 'validation',
					message: 'Expected a number.',
					path: [],
					context: [{ type: 'union', branchIndex: 1 }],
					payload: { value: null },
				},
			],
		})
	})

	it('continues after an asynchronous recoverable branch failure', async () => {
		const later = vi.fn((value: string) => value)
		const result = v.union([
			v.string().transform(async () => {
				throw new Error('recoverable')
			}),
			v.string().transform(later),
			v.number(),
		]).execute('hello')

		expect(result).toBeInstanceOf(Promise)
		await expect(result).resolves.toEqual({ value: 'hello' })
		expect(later).toHaveBeenCalledOnce()
	})

	it('does not evaluate later branches after a synchronous internal failure', () => {
		const later = vi.fn()
		const schema = (v as any).union([
			v.number(),
			(v as any).unknown().internalFailure(),
			(v as any).unknown().observe(later),
		])
		const result = schema.execute('value')

		expect(result).toMatchObject({
			issues: [{
				code: 'core:unknown_exception',
				category: 'internal',
				context: [{ type: 'union', branchIndex: 1 }],
				payload: { method: 'internalFailure' },
			}],
		})
		expect((result as any).issues).toHaveLength(1)
		expect(later).not.toHaveBeenCalled()
	})

	it('does not evaluate later branches after an asynchronous internal failure', async () => {
		const later = vi.fn()
		const schema = (v as any).union([
			v.number(),
			(v as any).unknown().asyncInternalFailure(),
			(v as any).unknown().observe(later),
		])
		const result = schema.execute('value')

		expect(result).toBeInstanceOf(Promise)
		await expect(result).resolves.toMatchObject({
			issues: [{
				code: 'core:unknown_exception',
				category: 'internal',
				context: [{ type: 'union', branchIndex: 1 }],
				payload: { method: 'asyncInternalFailure' },
			}],
		})
		expect(later).not.toHaveBeenCalled()
	})
})
