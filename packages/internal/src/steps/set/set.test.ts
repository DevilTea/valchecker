import { describe, expect, it, vi } from 'vitest'
import { createValchecker, set, string, toAsync, transform, unknown } from '../..'
import { structuralFixture, syncTransformFixture } from '../../test-utils/fixtures'

const setFixture = structuralFixture

const v = createValchecker({
	steps: [set, setFixture, string, toAsync, transform, unknown],
})

describe('set step plugin', () => {
	it.each([
		['object', {}],
		['array', []],
		['map', new Map()],
		['null', null],
		['undefined', undefined],
	] as const)('rejects %s input as a non-Set', (_kind, value) => {
		expect(v.set(v.string())
			.execute(value))
			.toEqual({
				issues: [{
					code: 'set:expected_set',
					category: 'validation',
					message: 'Expected a Set.',
					path: [],
					payload: { value },
				}],
			})
	})

	it('uses a custom message for its owned classification issue', () => {
		expect(v.set(v.string(), { message: 'Set required' })
			.execute([]))
			.toMatchObject({
				issues: [{ code: 'set:expected_set', message: 'Set required' }],
			})
	})

	it('returns transformed items in insertion order without mutating the input', () => {
		const input = new Set<unknown>(['a', 'b'])
		const schema = v.set(v.string()
			.transform(value => value.toUpperCase()))

		expect(schema.execute(input))
			.toEqual({ value: new Set(['A', 'B']) })
		expect(input)
			.toEqual(new Set(['a', 'b']))
	})

	it('stops at the first invalid item, returning only the first-item issue', () => {
		expect(v.set(v.string())
			.execute(new Set<unknown>([1, 2])))
			.toEqual({
				issues: [{
					code: 'string:expected_string',
					category: 'validation',
					message: 'Expected a string.',
					path: [0],
					payload: { value: 1 },
				}],
			})
	})

	it('collects child issues with stable numeric paths', () => {
		expect(v.set(v.string(), { collectAllIssues: true })
			.execute(new Set<unknown>(['ok', 1, 2])))
			.toMatchObject({
				issues: [
					{ code: 'string:expected_string', path: [1], payload: { value: 1 } },
					{ code: 'string:expected_string', path: [2], payload: { value: 2 } },
				],
			})
	})

	it('applies the parent message handler to nested child issues', () => {
		const schema = v.set(v.string(), {
			message: issue => `set:${issue.code}`,
		})

		expect(schema.execute(new Set<unknown>([1])))
			.toMatchObject({
				issues: [{
					code: 'string:expected_string',
					message: 'set:string:expected_string',
				}],
			})
	})

	it('rejects transformed item collisions instead of silently deduplicating items', () => {
		const input = new Set(['A', 'a'])
		const schema = v.set(
			v.string()
				.transform(value => value.toLowerCase()),
			{ message: issue => `set:${issue.code}` },
		)

		expect(schema.execute(input))
			.toEqual({
				issues: [{
					code: 'set:duplicate_transformed_item',
					category: 'validation',
					message: 'set:set:duplicate_transformed_item',
					path: [1],
					payload: {
						value: input,
						firstItem: 'A',
						item: 'a',
						transformedItem: 'a',
						firstIndex: 0,
						index: 1,
					},
				}],
			})
	})

	it('uses SameValueZero when detecting transformed item collisions', () => {
		const schema = v.set(v.string()
			.transform(value => value === 'first' ? Number.NaN : Number.NaN))

		expect(schema.execute(new Set(['first', 'second'])))
			.toMatchObject({
				issues: [{ code: 'set:duplicate_transformed_item', path: [1] }],
			})
	})

	it('preserves fully synchronous collection execution', () => {
		const result = v.set(v.string())
			.execute(new Set(['a']))

		expect(result).not.toBeInstanceOf(Promise)
		expect(result)
			.toEqual({ value: new Set(['a']) })
	})

	it('continues sequentially after an item first returns a promise', async () => {
		let first = true
		const order: string[] = []
		const item = v.string()
			.transform((value) => {
				order.push(value)
				if (first) {
					first = false
					return Promise.resolve(value.toUpperCase())
				}
				return value.toUpperCase()
			})

		await expect(v.set(item)
			.execute(new Set(['a', 'b', 'c'])))
			.resolves.toEqual({ value: new Set(['A', 'B', 'C']) })
		expect(order)
			.toEqual(['a', 'b', 'c'])
	})

	it('continues later items after an asynchronous recoverable child failure', async () => {
		const observed = vi.fn()
		let first = true
		const item = v.string()
			.transform(async (value) => {
				if (first) {
					first = false
					throw new Error('recoverable')
				}
				return value
			})
			.transform((value) => {
				observed(value)
				return value
			})

		await expect(v.set(item, { collectAllIssues: true })
			.execute(new Set(['a', 'b', 'c'])))
			.resolves.toMatchObject({
				issues: [{ code: 'transform:callback_failed', path: [0] }],
			})
		expect(observed)
			.toHaveBeenCalledTimes(2)
	})

	it('stops later items after a synchronous internal child failure', () => {
		const observed = vi.fn()
		const internal = (v as any).unknown()
			.internalFailure()
		const later = (v as any).unknown()
			.observe(observed)
		const item = {
			'~execute': (value: unknown) => value === 'internal'
				? internal['~execute'](value)
				: later['~execute'](value),
		} as any

		expect((v as any).set(item)
			.execute(new Set(['internal', 'later'])))
			.toMatchObject({
				issues: [{
					code: 'core:unknown_exception',
					category: 'internal',
					path: [0],
				}],
			})
		expect(observed).not.toHaveBeenCalled()
	})

	it('stops later items after an asynchronous internal child failure', async () => {
		const observed = vi.fn()
		const internal = (v as any).unknown()
			.asyncInternalFailure()
		const later = (v as any).unknown()
			.observe(observed)
		const item = {
			'~execute': (value: unknown) => value === 'internal'
				? internal['~execute'](value)
				: later['~execute'](value),
		} as any

		await expect((v as any).set(item)
			.execute(new Set(['internal', 'later'])))
			.resolves.toMatchObject({
				issues: [{
					code: 'core:unknown_exception',
					category: 'internal',
					path: [0],
				}],
			})
		expect(observed).not.toHaveBeenCalled()
	})

	it('iterates the input Set live, observing items a child adds during validation', () => {
		// The step no longer snapshots items before child execution; it consumes
		// the native Set iterator lazily. A child that mutates the input Set during
		// validation therefore observes the same live iteration as the underlying
		// Set iterator, matching valibot/zod collection semantics.
		const input = new Set(['a'])
		const item = v.string()
			.transform((value) => {
				input.add('later')
				return value
			})

		expect(v.set(item)
			.execute(input))
			.toEqual({ value: new Set(['a', 'later']) })
	})

	it('reports a transformed-item collision in a maybe-async set resolved synchronously', () => {
		const item = v.string()
			.transform(value => value === 'b' ? 'a' : value)

		expect(v.set(item)
			.execute(new Set(['a', 'b'])))
			.toMatchObject({
				issues: [{ code: 'set:duplicate_transformed_item', path: [1], payload: { firstItem: 'a', item: 'b', transformedItem: 'a' } }],
			})
	})

	it('reports a collision on the item that resolves asynchronously', async () => {
		const item = v.string()
			.transform(value => value === 'b' ? Promise.resolve('a') : value)

		await expect(v.set(item)
			.execute(new Set(['a', 'b'])))
			.resolves.toMatchObject({
				issues: [{ code: 'set:duplicate_transformed_item', path: [1], payload: { firstItem: 'a', item: 'b', transformedItem: 'a' } }],
			})
	})

	it('reports a transformed-item collision found while continuing asynchronously', async () => {
		const item = v.string()
			.transform(value => Promise.resolve(value === 'b' ? 'a' : value))

		await expect(v.set(item)
			.execute(new Set(['a', 'b'])))
			.resolves.toMatchObject({
				issues: [{ code: 'set:duplicate_transformed_item', path: [1], payload: { firstItem: 'a', item: 'b', transformedItem: 'a' } }],
			})
	})

	it('stops at a recoverable failure in a later asynchronous item', async () => {
		const item = v.string()
			.transform(value => Promise.resolve(value))

		await expect(v.set(item)
			.execute(new Set<unknown>(['a', 2, 3])))
			.resolves.toMatchObject({ issues: [{ code: 'string:expected_string', path: [1] }] })
	})
})

describe('set collectAllIssues', () => {
	const fixture = structuralFixture

	const v = createValchecker({ steps: [fixture, set, string, transform, unknown] })

	it('retains Set classification before item traversal', () => {
		expect(v.set(v.string(), { collectAllIssues: true })
			.execute([]))
			.toMatchObject({ issues: [{ code: 'set:expected_set' }] })
	})

	it('reports transformed-item collisions and continues later items', async () => {
		let first = true
		const item = v.string()
			.transform((value) => {
				const transformed = value.toLowerCase()
				if (first) {
					first = false
					return Promise.resolve(transformed)
				}
				return transformed
			})

		const result = await v.set(item, { collectAllIssues: true })
			.execute(new Set(['A', 'a', 'B']))
		expect(result)
			.toMatchObject({
				issues: [{ code: 'set:duplicate_transformed_item', path: [1] }],
			})
	})

	it('stops later items after synchronous and asynchronous internal issues', async () => {
		for (const internal of [
			(v as any).unknown()
				.internalFailure(),
			(v as any).unknown()
				.asyncInternalFailure(),
		]) {
			const later = vi.fn()
			const observed = (v as any).unknown()
				.observe(later)
			const item = {
				'~execute': (value: unknown) => value === 'internal'
					? internal['~execute'](value)
					: observed['~execute'](value),
			} as any

			const result = await (v as any).set(item, { collectAllIssues: true })
				.execute(new Set(['internal', 'later']))
			expect(result)
				.toMatchObject({ issues: [{ code: 'core:unknown_exception' }] })
			expect(later).not.toHaveBeenCalled()
		}
	})
})

describe('set native snapshots', () => {
	const syncFixture = syncTransformFixture

	const v = createValchecker({ steps: [set, string, syncFixture, unknown] }) as any

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

	it('treats a NaN item as identity only when the transform keeps it NaN', () => {
		const fromNaN = v.unknown()
			.syncMap((value: unknown) => typeof value === 'number' && Number.isNaN(value) ? 'nan' : value)

		expect(v.set(fromNaN)
			.execute(new Set([Number.NaN])))
			.toEqual({ value: new Set(['nan']) })

		const toNaN = v.unknown()
			.syncMap(() => Number.NaN)

		expect(v.set(toNaN)
			.execute(new Set(['a'])))
			.toEqual({ value: new Set([Number.NaN]) })
	})

	it('reports the source index of a first occurrence that follows a failed item', () => {
		const input = new Set(['failed', 'a', 'A'])
		const item = v.unknown()
			.syncProcess((value: unknown) => value === 'failed'
				? { ok: false }
				: { ok: true, value: String(value)
						.toLowerCase() })
		const result = v.set(item, { collectAllIssues: true })
			.execute(input)

		expect(result.issues.map((issue: any) => issue.code))
			.toEqual([
				'fixture:rejected',
				'set:duplicate_transformed_item',
			])
		expect(result.issues[1])
			.toMatchObject({
				path: [2],
				payload: {
					firstItem: 'a',
					firstIndex: 1,
					item: 'A',
					index: 2,
				},
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
