import type { InferOperationMode, InferOutput } from '../../core'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createValchecker, map, number, string, toMappedKeys } from '../..'

const v = createValchecker({ steps: [map, number, string, toMappedKeys] })

describe('toMappedKeys step plugin', () => {
	it('maps a snapshot of the current Map pipeline value with entry value, index, and thisArg', () => {
		const context = { prefix: 'key:' }
		const input = new Map([['a', 1], ['b', 2]])
		const visited: string[] = []
		let callbackMap: Map<string, number> | undefined
		const schema = v.map({ key: v.string(), value: v.number() })
			.toMappedKeys(function (this: typeof context, key, entryValue, index, value) {
				visited.push(key)
				callbackMap ??= value
				expect(value)
					.toBe(callbackMap)
				if (index === 0)
					value.set('c', 3)
				return `${this.prefix}${key}:${entryValue + index}`
			}, { thisArg: context })

		expect(schema.execute(input))
			.toEqual({
				value: new Map([['key:a:1', 1], ['key:b:3', 2]]),
			})
		expect(input)
			.toEqual(new Map([['a', 1], ['b', 2]]))
		expect(callbackMap)
			.toEqual(new Map([['a', 1], ['b', 2], ['c', 3]]))
		expect(visited)
			.toEqual(['a', 'b'])
		expectTypeOf<InferOutput<typeof schema>>()
			.toEqualTypeOf<Map<string, number>>()
		expectTypeOf<InferOperationMode<typeof schema>>()
			.toEqualTypeOf<'sync'>()
	})

	it('converts callback exceptions into an operation issue', () => {
		const error = new Error('key mapper')
		const input = new Map([['a', 1], ['b', 2]])
		expect(v.map({ key: v.string(), value: v.number() })
			.toMappedKeys((key) => {
				if (key === 'b')
					throw error
				return key
			}, { message: 'Key mapping failed' })
			.execute(input))
			.toEqual({
				issues: [{
					code: 'toMappedKeys:callback_failed',
					category: 'operation',
					message: 'Key mapping failed',
					path: [],
					payload: { value: input, key: 'b', entryValue: 2, index: 1, error },
				}],
			})
	})

	it('rejects duplicate mapped keys with source provenance', () => {
		const input = new Map([['A', 1], ['a', 2]])
		expect(v.map({ key: v.string(), value: v.number() })
			.toMappedKeys(key => key.toLowerCase(), {
				message: issue => `keys:${issue.code}`,
			})
			.execute(input))
			.toEqual({
				issues: [{
					code: 'toMappedKeys:duplicate_mapped_key',
					category: 'validation',
					message: 'keys:toMappedKeys:duplicate_mapped_key',
					path: [],
					payload: {
						value: input,
						firstSourceKey: 'A',
						sourceKey: 'a',
						mappedKey: 'a',
						firstIndex: 0,
						index: 1,
					},
				}],
			})
	})

	it('uses SameValueZero when detecting mapped key collisions', () => {
		const input = new Map([['first', 1], ['second', 2]])
		expect(v.map({ key: v.string(), value: v.number() })
			.toMappedKeys(key => key === 'first' ? 0 : -0)
			.execute(input))
			.toMatchObject({
				issues: [{
					code: 'toMappedKeys:duplicate_mapped_key',
					payload: { firstIndex: 0, index: 1 },
				}],
			})
	})

	it('preserves mapper promises as Map keys instead of awaiting them', async () => {
		const result = v.map({ key: v.string(), value: v.number() })
			.toMappedKeys(async key => key.toUpperCase())
			.execute(new Map([['a', 1]]))

		expect(result).not.toBeInstanceOf(Promise)
		const promise = [...(result as any).value.keys()][0]
		expect(promise)
			.toBeInstanceOf(Promise)
		await expect(promise).resolves.toBe('A')
	})
})
