import { describe, expect, it } from 'vitest'
import { createValchecker, map, number, string, unknown } from '../..'
import { syncTransformFixture } from '../../test-utils/fixtures'

const syncFixture = syncTransformFixture

const v = createValchecker({ steps: [map, number, string, syncFixture, unknown] }) as any

describe('map lazy output allocation', () => {
	it('returns a fresh Map for identity-only success', () => {
		const input = new Map([['a', 1], ['b', 2]])
		const result = v.map({ key: v.string(), value: v.number() })
			.execute(input)

		expect(result)
			.toEqual({ value: new Map([['a', 1], ['b', 2]]) })
		expect(result.value).not.toBe(input)
	})

	it('snapshots the complete workload before synchronous callbacks mutate the source', () => {
		const input = new Map([['a', 1]])
		const key = v.unknown()
			.syncMap((value: unknown) => {
				input.set('later', 2)
				return value
			})

		expect(v.map({ key, value: v.number() })
			.execute(input))
			.toEqual({
				value: new Map([['a', 1]]),
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

	it('preserves size lookup and overridden forEach call semantics', () => {
		const input = new Map([['source', 1]])
		const order: string[] = []
		Object.defineProperty(input, 'size', {
			get() {
				order.push('size')
				return 1
			},
		})
		const overriddenForEach = (callback: (value: unknown, key: unknown) => void) => {
			order.push('call')
			callback(1, 'a')
		}
		Object.defineProperty(overriddenForEach, 'call', {
			value: () => {
				throw new Error('Function.call must not be observed.')
			},
		})
		Object.defineProperty(input, 'forEach', {
			get() {
				order.push('forEach')
				return overriddenForEach
			},
		})

		expect(v.map({ key: v.string(), value: v.number() })
			.execute(input))
			.toEqual({
				value: new Map([['a', 1]]),
			})
		expect(order)
			.toEqual(['size', 'forEach', 'call'])
	})

	it('retains the original executor for an overridden forEach method', () => {
		const input = new Map([['source', 1]])
		let getterCalls = 0
		Object.defineProperty(input, 'forEach', {
			get() {
				getterCalls++
				return function (callback: (value: unknown, key: unknown) => void) {
					callback(1, 'a')
					callback(2, 'a')
				}
			},
		})

		expect(v.map({ key: v.string(), value: v.number() })
			.execute(input))
			.toMatchObject({
				issues: [{
					code: 'map:duplicate_transformed_key',
					path: [1, 'key'],
					payload: {
						firstSourceKey: 'a',
						sourceKey: 'a',
						firstIndex: 0,
						index: 1,
					},
				}],
			})
		expect(getterCalls)
			.toBe(1)
	})
})
