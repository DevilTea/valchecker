import { describe, expect, it } from 'vitest'
import { createValchecker, set, string, unknown } from '../..'
import { syncTransformFixture } from '../../test-utils/fixtures'

const syncFixture = syncTransformFixture

const v = createValchecker({ steps: [set, string, syncFixture, unknown] }) as any

describe('set native snapshots', () => {
	it('returns a fresh native snapshot for identity-only success', () => {
		const input = new Set(['a', 'b'])
		const result = v.set(v.string())
			.execute(input)

		expect(result)
			.toEqual({ value: new Set(['a', 'b']) })
		expect(result.value).not.toBe(input)
	})

	it('iterates live, so a synchronous callback that mutates the source is observed', () => {
		const input = new Set(['a'])
		const item = v.unknown()
			.syncMap((value: unknown) => {
				input.add('later')
				return value
			})

		expect(v.set(item)
			.execute(input))
			.toEqual({ value: new Set(['a', 'later']) })
		expect(input)
			.toEqual(new Set(['a', 'later']))
	})

	it('preserves insertion order after the first actual transformation', () => {
		const item = v.unknown()
			.syncMap((value: unknown) => value === 'a' ? 'x' : value)

		expect(v.set(item)
			.execute(new Set(['a', 'b', 'c'])))
			.toEqual({
				value: new Set(['x', 'b', 'c']),
			})
	})

	it('materializes buffered identity items before a later transformation', () => {
		// Identity items 'a' and 'b' are buffered; the transform on 'c' forces the
		// output Set to materialize, seeded from the buffered prefix.
		const item = v.unknown()
			.syncMap((value: unknown) => value === 'c' ? 'x' : value)

		expect(v.set(item)
			.execute(new Set(['a', 'b', 'c'])))
			.toEqual({
				value: new Set(['a', 'b', 'x']),
			})
	})

	it('reports a collision when a transformed item claims a future source value', () => {
		const input = new Set(['a', 'b'])
		const item = v.unknown()
			.syncMap((value: unknown) => value === 'a' ? 'b' : value)

		expect(v.set(item)
			.execute(input))
			.toEqual({
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
		const item = v.unknown()
			.syncMap(() => 'x')

		expect(v.set(item)
			.execute(input))
			.toMatchObject({
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
		const item = v.unknown()
			.syncMap((value: unknown) => {
				if (typeof value === 'number' && Number.isNaN(value))
					return Number.NaN
				return -0
			})

		expect(v.set(item)
			.execute(new Set([Number.NaN, 0])))
			.toEqual({
				value: new Set([Number.NaN, 0]),
			})
	})

	it('excludes failed prefix items when transformation state is initialized later', () => {
		const input = new Set(['failed', 'a', 'b'])
		const item = v.unknown()
			.syncProcess((value: unknown) => {
				if (value === 'failed')
					return { ok: false }
				return { ok: true, value: value === 'a' ? 'failed' : value }
			})
		const result = v.set(item, { collectAllIssues: true })
			.execute(input)

		expect(result.issues.map((issue: any) => issue.code))
			.toEqual(['fixture:rejected'])
		expect(result.issues[0])
			.toMatchObject({ path: [0] })
	})

	it('validates the real items via the native iterator, ignoring an overridden values', () => {
		// Iteration uses Set.prototype.values, not the instance values, so a
		// subclass or tampered instance cannot redirect validation away from its
		// actual items. The spoofed generator would inject a duplicate 'a', but
		// native iteration sees only the real item.
		const input = new Set(['source'])
		Object.defineProperty(input, 'values', {
			get() {
				return function* () {
					yield 'a'
					yield 'a'
				}
			},
		})

		expect(v.set(v.string())
			.execute(input))
			.toEqual({ value: new Set(['source']) })
	})
})
