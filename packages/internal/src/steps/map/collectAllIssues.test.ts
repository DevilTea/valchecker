import { describe, expect, it, vi } from 'vitest'
import { createValchecker, map, number, string, transform, unknown } from '../..'
import { structuralFixture } from '../../test-utils/fixtures'

const fixture = structuralFixture

const v = createValchecker({ steps: [fixture, map, number, string, transform, unknown] })

describe('map collectAllIssues', () => {
	it('retains Map classification before entry traversal', () => {
		expect(v.map({
			key: v.string(),
			value: v.number(),
			collectAllIssues: true,
		})
			.execute({}))
			.toMatchObject({ issues: [{ code: 'map:expected_map' }] })
	})

	it('short-circuits default asynchronous key and value failures', async () => {
		const valueRuns = vi.fn()
		await expect(v.map({
			key: v.string()
				.transform(async () => {
					throw new Error('key')
				}),
			value: v.number()
				.transform((value) => {
					valueRuns()
					return value
				}),
		})
			.execute(new Map([['a', 1], ['b', 2]])))
			.resolves.toMatchObject({ issues: [{ code: 'transform:callback_failed', path: [0, 'key'] }] })
		expect(valueRuns).not.toHaveBeenCalled()

		await expect(v.map({
			key: v.string(),
			value: v.number()
				.transform(async () => {
					throw new Error('value')
				}),
		})
			.execute(new Map([['a', 1], ['b', 2]])))
			.resolves.toMatchObject({ issues: [{ code: 'transform:callback_failed', path: [0, 'value'] }] })
	})

	it('returns ordered outputs after asynchronous key or value validation', async () => {
		await expect(v.map({
			key: v.string()
				.transform(async value => value.toUpperCase()),
			value: v.number(),
		})
			.execute(new Map([['a', 1], ['b', 2]])))
			.resolves.toEqual({ value: new Map([['A', 1], ['B', 2]]) })

		await expect(v.map({
			key: v.string(),
			value: v.number()
				.transform(async value => value * 10),
		})
			.execute(new Map([['a', 1], ['b', 2]])))
			.resolves.toEqual({ value: new Map([['a', 10], ['b', 20]]) })
	})

	it('reports transformed-key collisions and continues later entries', async () => {
		expect(v.map({
			key: v.string()
				.transform(value => value.toLowerCase()),
			value: v.number(),
			collectAllIssues: true,
		})
			.execute(new Map([['A', 1], ['a', 2], ['B', 3]])))
			.toMatchObject({ issues: [{ code: 'map:duplicate_transformed_key', path: [1, 'key'] }] })

		let first = true
		await expect(v.map({
			key: v.string()
				.transform((value) => {
					const transformed = value.toLowerCase()
					if (first) {
						first = false
						return Promise.resolve(transformed)
					}
					return transformed
				}),
			value: v.number()
				.transform(async value => value),
			collectAllIssues: true,
		})
			.execute(new Map([['A', 1], ['a', 2], ['B', 3]])))
			.resolves.toMatchObject({ issues: [{ code: 'map:duplicate_transformed_key', path: [1, 'key'] }] })
	})

	it('stops the current value and later entries after an internal key issue', async () => {
		const valueRuns = vi.fn()
		await expect((v as any).map({
			key: (v as any).unknown()
				.asyncInternalFailure(),
			value: (v as any).unknown()
				.observe(valueRuns),
			collectAllIssues: true,
		})
			.execute(new Map([['a', 1], ['b', 2]])))
			.resolves.toMatchObject({ issues: [{ code: 'core:unknown_exception', path: [0, 'key'] }] })
		expect(valueRuns).not.toHaveBeenCalled()
	})

	it('stops later entries after an internal value issue', async () => {
		const later = vi.fn()
		const internal = (v as any).unknown()
			.asyncInternalFailure()
		const observed = (v as any).unknown()
			.observe(later)
		const value = {
			'~execute': (entryValue: unknown) => entryValue === 'internal'
				? internal['~execute'](entryValue)
				: observed['~execute'](entryValue),
		} as any

		await expect((v as any).map({
			key: v.string(),
			value,
			collectAllIssues: true,
		})
			.execute(new Map([['a', 'internal'], ['b', 'later']])))
			.resolves.toMatchObject({ issues: [{ code: 'core:unknown_exception', path: [0, 'value'] }] })
		expect(later).not.toHaveBeenCalled()
	})
})
