import { describe, expect, it, vi } from 'vitest'
import { createValchecker, set, string, toAsync, transform, unknown } from '../..'
import { structuralFixture } from '../../test-utils/fixtures'

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

	it('snapshots items before child execution mutates the input Set', () => {
		const input = new Set(['a'])
		const item = v.string()
			.transform((value) => {
				input.add('later')
				return value
			})

		expect(v.set(item)
			.execute(input))
			.toEqual({ value: new Set(['a']) })
	})
})
