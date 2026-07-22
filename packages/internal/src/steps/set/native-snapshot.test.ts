import { describe, expect, it } from 'vitest'
import { implStepPlugin } from '../../core'
import { createValchecker, set, string, unknown } from '../..'

const syncFixture = implStepPlugin<any>({
	syncMap: ({ utils, params: [run] }: any) => {
		utils.addSuccessStep((value: unknown) => utils.success(run(value)), 'sync')
	},
	syncProcess: ({ utils, params: [run] }: any) => {
		utils.addSuccessStep((value: unknown) => {
			const result = run(value)
			return result.ok
				? utils.success(result.value)
				: utils.failure(utils.createIssue({
					code: 'fixture:rejected',
					payload: { value },
					defaultMessage: 'Rejected by fixture.',
				}))
		}, 'sync')
	},
}, 'sync')

const v = createValchecker({ steps: [set, string, syncFixture, unknown] }) as any

describe('Set native snapshots', () => {
	it('returns a fresh native snapshot for identity-only success', () => {
		const input = new Set(['a', 'b'])
		const result = v.set(v.string()).execute(input)

		expect(result).toEqual({ value: new Set(['a', 'b']) })
		expect(result.value).not.toBe(input)
	})

	it('snapshots the complete workload before synchronous callbacks mutate the source', () => {
		const input = new Set(['a'])
		const item = v.unknown().syncMap((value: unknown) => {
			input.add('later')
			return value
		})

		expect(v.set(item).execute(input)).toEqual({ value: new Set(['a']) })
		expect(input).toEqual(new Set(['a', 'later']))
	})

	it('preserves insertion order after the first actual transformation', () => {
		const item = v.unknown().syncMap((value: unknown) => value === 'a' ? 'x' : value)

		expect(v.set(item).execute(new Set(['a', 'b', 'c']))).toEqual({
			value: new Set(['x', 'b', 'c']),
		})
	})

	it('reports a collision when a transformed item claims a future source value', () => {
		const input = new Set(['a', 'b'])
		const item = v.unknown().syncMap((value: unknown) => value === 'a' ? 'b' : value)

		expect(v.set(item).execute(input)).toEqual({
			issues: [{
				code: 'set:duplicate_transformed_item',
				category: 'validation',
				message: 'Expected transformed Set items to be unique.',
				path: [1],
				payload: {
					value: input,
					firstItem: 'a',
					item: 'b',
					transformedItem: 'b',
					firstIndex: 0,
					index: 1,
				},
			}],
		})
	})

	it('reports collisions against prior transformed output metadata', () => {
		const input = new Set(['a', 'b'])
		const item = v.unknown().syncMap(() => 'x')

		expect(v.set(item).execute(input)).toMatchObject({
			issues: [{
				code: 'set:duplicate_transformed_item',
				path: [1],
				payload: {
					firstItem: 'a',
					item: 'b',
					transformedItem: 'x',
					firstIndex: 0,
					index: 1,
				},
			}],
		})
	})

	it('uses SameValueZero to keep NaN and signed zero on the identity path', () => {
		const item = v.unknown().syncMap((value: unknown) => {
			if (typeof value === 'number' && Number.isNaN(value))
				return Number.NaN
			return -0
		})

		expect(v.set(item).execute(new Set([Number.NaN, 0]))).toEqual({
			value: new Set([Number.NaN, 0]),
		})
	})

	it('excludes failed prefix items when transformation state is initialized later', () => {
		const input = new Set(['failed', 'a', 'b'])
		const item = v.unknown().syncProcess((value: unknown) => {
			if (value === 'failed')
				return { ok: false }
			return { ok: true, value: value === 'a' ? 'failed' : value }
		})

		expect(v.set(item, { collectAllIssues: true }).execute(input)).toMatchObject({
			issues: [{
				code: 'fixture:rejected',
				path: [0],
			}],
		})
	})

	it('retains the array snapshot contract for an overridden values method', () => {
		const input = new Set(['source'])
		Object.defineProperty(input, 'values', {
			value: function* () {
				yield 'a'
				yield 'a'
			},
		})

		expect(v.set(v.string()).execute(input)).toMatchObject({
			issues: [{
				code: 'set:duplicate_transformed_item',
				path: [1],
				payload: {
					firstItem: 'a',
					item: 'a',
					firstIndex: 0,
					index: 1,
				},
			}],
		})
	})
})
