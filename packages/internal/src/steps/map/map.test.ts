import { describe, expect, it, vi } from 'vitest'
import { createValchecker, map, number, string, toAsync, transform, unknown } from '../..'
import { structuralFixture, syncTransformFixture } from '../../test-utils/fixtures'

const mapFixture = structuralFixture

const v = createValchecker({
	steps: [map, mapFixture, number, string, toAsync, transform, unknown],
})

describe('map step plugin', () => {
	it.each([
		['object', {}],
		['array', []],
		['set', new Set()],
		['null', null],
		['undefined', undefined],
	] as const)('rejects %s input as a non-Map', (_kind, value) => {
		expect(v.map({ key: v.string(), value: v.number() })
			.execute(value))
			.toEqual({
				issues: [{
					code: 'map:expected_map',
					category: 'validation',
					message: 'Expected a Map.',
					path: [],
					payload: { value },
				}],
			})
	})

	it('uses the configuration message for its owned classification issue', () => {
		expect(v.map({
			key: v.string(),
			value: v.number(),
			message: 'Map required',
		})
			.execute({}))
			.toMatchObject({
				issues: [{ code: 'map:expected_map', message: 'Map required' }],
			})
	})

	it('returns transformed keys and values in insertion order without mutating the input', () => {
		const input = new Map<unknown, unknown>([['a', 1], ['b', 2]])
		const schema = v.map({
			key: v.string()
				.transform(value => value.toUpperCase()),
			value: v.number()
				.transform(value => value * 10),
		})

		expect(schema.execute(input))
			.toEqual({
				value: new Map([['A', 10], ['B', 20]]),
			})
		expect(input)
			.toEqual(new Map([['a', 1], ['b', 2]]))
	})

	it('collects recoverable key and value issues with stable entry paths', () => {
		expect(v.map({ key: v.string(), value: v.number(), collectAllIssues: true })
			.execute(new Map<unknown, unknown>([[1, 'x'], ['ok', 'y']])))
			.toMatchObject({
				issues: [
					{ code: 'string:expected_string', path: [0, 'key'], payload: { value: 1 } },
					{ code: 'number:expected_number', path: [0, 'value'], payload: { value: 'x' } },
					{ code: 'number:expected_number', path: [1, 'value'], payload: { value: 'y' } },
				],
			})
	})

	it('applies the parent message handler to nested child issues', () => {
		const schema = v.map({
			key: v.string(),
			value: v.number(),
			message: issue => `map:${issue.code}`,
			collectAllIssues: true,
		})

		expect(schema.execute(new Map([[1, 'x']])))
			.toMatchObject({
				issues: [
					{ code: 'string:expected_string', message: 'map:string:expected_string' },
					{ code: 'number:expected_number', message: 'map:number:expected_number' },
				],
			})
	})

	it('rejects transformed key collisions instead of silently overwriting entries', () => {
		const input = new Map([['A', 1], ['a', 2]])
		const schema = v.map({
			key: v.string()
				.transform(value => value.toLowerCase()),
			value: v.number(),
			message: issue => `map:${issue.code}`,
		})

		expect(schema.execute(input))
			.toEqual({
				issues: [{
					code: 'map:duplicate_transformed_key',
					category: 'validation',
					message: 'map:map:duplicate_transformed_key',
					path: [1, 'key'],
					payload: {
						value: input,
						firstSourceKey: 'A',
						sourceKey: 'a',
						transformedKey: 'a',
						firstIndex: 0,
						index: 1,
					},
				}],
			})
	})

	it('uses SameValueZero when detecting transformed key collisions', () => {
		const schema = v.map({
			key: v.string()
				.transform(value => value === 'first' ? 0 : -0),
			value: v.number(),
		})

		expect(schema.execute(new Map([['first', 1], ['second', 2]])))
			.toMatchObject({
				issues: [{ code: 'map:duplicate_transformed_key', path: [1, 'key'] }],
			})
	})

	it('preserves fully synchronous collection execution', () => {
		const result = v.map({ key: v.string(), value: v.number() })
			.execute(new Map([['a', 1]]))

		expect(result).not.toBeInstanceOf(Promise)
		expect(result)
			.toEqual({ value: new Map([['a', 1]]) })
	})

	it('continues sequentially after a key first returns a promise', async () => {
		let first = true
		const order: string[] = []
		const key = v.string()
			.transform((value) => {
				order.push(`key:${value}`)
				if (first) {
					first = false
					return Promise.resolve(value.toUpperCase())
				}
				return value.toUpperCase()
			})
		const value = v.number()
			.transform((entryValue) => {
				order.push(`value:${entryValue}`)
				return entryValue
			})

		await expect(v.map({ key, value })
			.execute(new Map([['a', 1], ['b', 2]])))
			.resolves.toEqual({ value: new Map([['A', 1], ['B', 2]]) })
		expect(order)
			.toEqual(['key:a', 'value:1', 'key:b', 'value:2'])
	})

	it('continues value validation and later entries after an asynchronous recoverable key failure', async () => {
		const observed = vi.fn()
		const key = v.string()
			.transform(async () => {
				throw new Error('recoverable')
			})
		const value = (v as any).number()
			.observe(observed)

		await expect(v.map({ key, value, collectAllIssues: true })
			.execute(new Map([['a', 1], ['b', 2]])))
			.resolves.toMatchObject({
				issues: [
					{ code: 'transform:callback_failed', path: [0, 'key'] },
					{ code: 'transform:callback_failed', path: [1, 'key'] },
				],
			})
		expect(observed)
			.toHaveBeenCalledTimes(2)
	})

	it('stops the current value and later entries after an internal key failure', () => {
		const observed = vi.fn()
		const internal = (v as any).unknown()
			.internalFailure()
		const normal = v.string()
		const key = {
			'~execute': (value: unknown) => value === 'internal'
				? internal['~execute'](value)
				: normal['~execute'](value),
		} as any
		const value = (v as any).number()
			.observe(observed)

		expect((v as any).map({ key, value })
			.execute(new Map([['internal', 1], ['later', 2]])))
			.toMatchObject({
				issues: [{
					code: 'core:unknown_exception',
					category: 'internal',
					path: [0, 'key'],
				}],
			})
		expect(observed).not.toHaveBeenCalled()
	})

	it('stops later entries after an asynchronous internal value failure', async () => {
		const observed = vi.fn()
		const internal = (v as any).unknown()
			.asyncInternalFailure()
		const later = (v as any).unknown()
			.observe(observed)
		const value = {
			'~execute': (entryValue: unknown) => entryValue === 'internal'
				? internal['~execute'](entryValue)
				: later['~execute'](entryValue),
		} as any

		await expect((v as any).map({ key: v.string(), value })
			.execute(new Map([['a', 'internal'], ['b', 'later']])))
			.resolves.toMatchObject({
				issues: [{
					code: 'core:unknown_exception',
					category: 'internal',
					path: [0, 'value'],
				}],
			})
		expect(observed).not.toHaveBeenCalled()
	})

	it('iterates the input Map live, observing entries a child adds during validation', () => {
		// The step no longer snapshots entries before child execution; it consumes
		// the native Map iterator lazily. A child that mutates the input Map during
		// validation therefore observes the same live iteration as the underlying
		// Map iterator, matching valibot/zod collection semantics.
		const input = new Map([['a', 1]])
		const key = v.string()
			.transform((value) => {
				input.set('later', 2)
				return value
			})

		expect(v.map({ key, value: v.number() })
			.execute(input))
			.toEqual({
				value: new Map([['a', 1], ['later', 2]]),
			})
	})

	it('stops at the first invalid key, returning only the first-entry issue', () => {
		const result = v.map({ key: v.string(), value: v.number() })
			.execute(new Map<unknown, unknown>([[1, 'a'], [2, 'b']]))

		expect(result)
			.toEqual({ issues: [{
				code: 'string:expected_string',
				category: 'validation',
				message: 'Expected a string.',
				path: [0, 'key'],
				payload: { value: 1 },
			}] })
	})

	it('stops at an invalid value and does not validate later entries', () => {
		expect(v.map({ key: v.string(), value: v.number() })
			.execute(new Map<unknown, unknown>([['a', 'x'], ['b', 2]])))
			.toMatchObject({ issues: [{ code: 'number:expected_number', path: [0, 'value'] }] })
	})

	it('reports a transformed-key collision in a maybe-async map resolved synchronously', () => {
		const key = v.string()
			.transform(entryKey => entryKey === 'b' ? 'a' : entryKey)
		expect(v.map({ key, value: v.number() })
			.execute(new Map([['a', 1], ['b', 2]])))
			.toMatchObject({
				issues: [{ code: 'map:duplicate_transformed_key', path: [1, 'key'], payload: { firstSourceKey: 'a', sourceKey: 'b', transformedKey: 'a' } }],
			})
	})

	it('stops at an invalid value while the map is maybe-async', () => {
		const value = v.number()
			.transform(entryValue => Promise.resolve(entryValue))
		expect(v.map({ key: v.string(), value })
			.execute(new Map<unknown, unknown>([['a', 'x'], ['b', 2]])))
			.toMatchObject({ issues: [{ code: 'number:expected_number', path: [0, 'value'] }] })
	})
})

describe('map collectAllIssues', () => {
	const fixture = structuralFixture

	const v = createValchecker({ steps: [fixture, map, number, string, transform, unknown] })

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

describe('map lazy output allocation', () => {
	const syncFixture = syncTransformFixture

	const v = createValchecker({ steps: [map, number, string, syncFixture, unknown] }) as any

	it('returns a fresh Map for identity-only success', () => {
		const input = new Map([['a', 1], ['b', 2]])
		const result = v.map({ key: v.string(), value: v.number() })
			.execute(input)

		expect(result)
			.toEqual({ value: new Map([['a', 1], ['b', 2]]) })
		expect(result.value).not.toBe(input)
	})

	it('iterates live, so a synchronous callback that mutates the source is observed', () => {
		const input = new Map([['a', 1]])
		const key = v.unknown()
			.syncMap((value: unknown) => {
				input.set('later', 2)
				return value
			})

		expect(v.map({ key, value: v.number() })
			.execute(input))
			.toEqual({
				value: new Map([['a', 1], ['later', 2]]),
			})
		expect(input)
			.toEqual(new Map([['a', 1], ['later', 2]]))
	})

	it('preserves insertion order after the first actual value transformation', () => {
		const value = v.unknown()
			.syncMap((entryValue: unknown) => entryValue === 1 ? 10 : entryValue)

		expect(v.map({ key: v.string(), value })
			.execute(new Map([
				['a', 1],
				['b', 2],
				['c', 3],
			])))
			.toEqual({
				value: new Map([['a', 10], ['b', 2], ['c', 3]]),
			})
	})

	it('uses Object.is for value identity', () => {
		const value = v.unknown()
			.syncMap(() => -0)
		const result = v.map({ key: v.string(), value })
			.execute(new Map([['a', 0]]))

		expect(Object.is(result.value.get('a'), -0))
			.toBe(true)
	})

	it('reports a collision when a transformed key claims a future source key', () => {
		const input = new Map([['a', 1], ['b', 2]])
		const key = v.unknown()
			.syncMap((sourceKey: unknown) => sourceKey === 'a' ? 'b' : sourceKey)

		expect(v.map({ key, value: v.number() })
			.execute(input))
			.toEqual({
				issues: [{
					code: 'map:duplicate_transformed_key',
					category: 'validation',
					message: 'Expected transformed Map keys to be unique.',
					path: [1, 'key'],
					payload: {
						value: input,
						firstSourceKey: 'a',
						sourceKey: 'b',
						transformedKey: 'b',
						firstIndex: 0,
						index: 1,
					},
				}],
			})
	})

	it('reports collisions against prior transformed-key metadata', () => {
		const input = new Map([['a', 1], ['b', 2]])
		const key = v.unknown()
			.syncMap(() => 'x')

		expect(v.map({ key, value: v.number() })
			.execute(input))
			.toMatchObject({
				issues: [{
					code: 'map:duplicate_transformed_key',
					path: [1, 'key'],
					payload: {
						firstSourceKey: 'a',
						sourceKey: 'b',
						transformedKey: 'x',
						firstIndex: 0,
						index: 1,
					},
				}],
			})
	})

	it('uses SameValueZero for key identity', () => {
		const key = v.unknown()
			.syncMap((sourceKey: unknown) => {
				if (typeof sourceKey === 'number' && Number.isNaN(sourceKey))
					return Number.NaN
				return -0
			})

		expect(v.map({ key, value: v.string() })
			.execute(new Map([
				[Number.NaN, 'nan'],
				[0, 'zero'],
			])))
			.toEqual({
				value: new Map([[Number.NaN, 'nan'], [0, 'zero']]),
			})
	})

	it('does not reserve a failed prefix key for later transformed output', () => {
		const input = new Map([['failed', 1], ['a', 2]])
		const key = v.unknown()
			.syncProcess((sourceKey: unknown) => {
				if (sourceKey === 'failed')
					return { ok: false }
				return { ok: true, value: 'failed' }
			})
		const result = v.map({ key, value: v.number(), collectAllIssues: true })
			.execute(input)

		expect(result.issues.map((issue: any) => issue.code))
			.toEqual(['fixture:rejected'])
		expect(result.issues[0])
			.toMatchObject({ path: [0, 'key'] })
	})

	it('keeps a successful prefix key reserved across a later failure', () => {
		const input = new Map<string, number | string>([['kept', 1], ['failed', 'bad'], ['later', 2]])
		const key = v.unknown()
			.syncMap((sourceKey: unknown) => sourceKey === 'later' ? 'kept' : sourceKey)
		const value = v.unknown()
			.syncProcess((entryValue: unknown) => entryValue === 'bad'
				? { ok: false }
				: { ok: true, value: entryValue })
		const result = v.map({ key, value, collectAllIssues: true })
			.execute(input)

		expect(result.issues.map((issue: any) => issue.code))
			.toEqual([
				'fixture:rejected',
				'map:duplicate_transformed_key',
			])
		expect(result.issues[1])
			.toMatchObject({
				path: [2, 'key'],
				payload: {
					firstSourceKey: 'kept',
					firstIndex: 0,
					sourceKey: 'later',
					index: 2,
				},
			})
	})

	it('does not reserve the key of a failed value entry', () => {
		const input = new Map([['failed', 'bad'], ['a', 'ok']])
		const key = v.unknown()
			.syncMap((sourceKey: unknown) => sourceKey === 'a' ? 'failed' : sourceKey)
		const value = v.unknown()
			.syncProcess((entryValue: unknown) => entryValue === 'bad'
				? { ok: false }
				: { ok: true, value: entryValue })
		const result = v.map({ key, value, collectAllIssues: true })
			.execute(input)

		expect(result.issues.map((issue: any) => issue.code))
			.toEqual(['fixture:rejected'])
		expect(result.issues[0])
			.toMatchObject({ path: [0, 'value'] })
	})

	it('validates the real entries via the native iterator, ignoring an overridden forEach/size', () => {
		// Iteration uses Map.prototype.entries, not the instance forEach/size, so a
		// subclass or tampered instance cannot redirect validation away from its
		// actual entries.
		const input = new Map([['source', 1]])
		Object.defineProperty(input, 'size', {
			get() {
				throw new Error('size must not be observed')
			},
		})
		Object.defineProperty(input, 'forEach', {
			get() {
				throw new Error('forEach must not be observed')
			},
		})

		expect(v.map({ key: v.string(), value: v.number() })
			.execute(input))
			.toEqual({
				value: new Map([['source', 1]]),
			})
	})

	it('ignores an overridden forEach that would inject spoofed duplicate entries', () => {
		const input = new Map([['source', 1]])
		Object.defineProperty(input, 'forEach', {
			get() {
				return function (callback: (value: unknown, key: unknown) => void) {
					callback(1, 'a')
					callback(2, 'a')
				}
			},
		})

		// The spoofed forEach would create a duplicate 'a' key, but native
		// iteration sees only the real entry, so validation succeeds.
		expect(v.map({ key: v.string(), value: v.number() })
			.execute(input))
			.toEqual({
				value: new Map([['source', 1]]),
			})
	})
})

describe('map asynchronous value continuation', () => {
	const v = createValchecker({
		steps: [map, number, string, transform],
	})

	it('continues entries sequentially after a value first returns a promise', async () => {
		let first = true
		const order: string[] = []
		const value = v.number()
			.transform((entryValue) => {
				order.push(`value:${entryValue}`)
				if (first) {
					first = false
					return Promise.resolve(entryValue * 10)
				}
				return entryValue * 10
			})
		const key = v.string()
			.transform((entryKey) => {
				order.push(`key:${entryKey}`)
				return entryKey.toUpperCase()
			})

		await expect(v.map({ key, value })
			.execute(new Map([['a', 1], ['b', 2]])))
			.resolves.toEqual({ value: new Map([['A', 10], ['B', 20]]) })
		expect(order)
			.toEqual(['key:a', 'value:1', 'key:b', 'value:2'])
	})

	it('does not append a synchronous key failure again when the value starts async continuation', async () => {
		const value = v.number()
			.transform(entryValue => Promise.resolve(entryValue))

		await expect(v.map({ key: v.number(), value, collectAllIssues: true })
			.execute(new Map<unknown, number>([['bad', 1]])))
			.resolves.toEqual({
				issues: [{
					code: 'number:expected_number',
					category: 'validation',
					message: 'Expected a number.',
					path: [0, 'key'],
					payload: { value: 'bad' },
				}],
			})
	})

	it('reports a transformed-key collision found while continuing asynchronously', async () => {
		const key = v.string()
			.transform(entryKey => Promise.resolve(entryKey === 'b' ? 'a' : entryKey))

		await expect(v.map({ key, value: v.number() })
			.execute(new Map([['a', 1], ['b', 2]])))
			.resolves.toMatchObject({
				issues: [{ code: 'map:duplicate_transformed_key', path: [1, 'key'], payload: { firstSourceKey: 'a', sourceKey: 'b', transformedKey: 'a' } }],
			})
	})

	it('reports a collision on the entry whose key resolves asynchronously', async () => {
		const key = v.string()
			.transform(entryKey => entryKey === 'b' ? Promise.resolve('a') : entryKey)

		await expect(v.map({ key, value: v.number() })
			.execute(new Map([['a', 1], ['b', 2]])))
			.resolves.toMatchObject({
				issues: [{ code: 'map:duplicate_transformed_key', path: [1, 'key'], payload: { firstSourceKey: 'a', sourceKey: 'b', transformedKey: 'a' } }],
			})
	})

	it('stops at a recoverable key failure in a later asynchronous entry', async () => {
		const key = v.string()
			.transform(entryKey => Promise.resolve(entryKey))

		await expect(v.map({ key, value: v.number() })
			.execute(new Map<unknown, unknown>([['a', 1], [2, 3]])))
			.resolves.toMatchObject({ issues: [{ code: 'string:expected_string', path: [1, 'key'] }] })
	})

	it('stops at a recoverable value failure in a later asynchronous entry', async () => {
		const key = v.string()
			.transform(entryKey => Promise.resolve(entryKey))

		await expect(v.map({ key, value: v.number() })
			.execute(new Map<unknown, unknown>([['a', 1], ['b', 'x']])))
			.resolves.toMatchObject({ issues: [{ code: 'number:expected_number', path: [1, 'value'] }] })
	})
})
