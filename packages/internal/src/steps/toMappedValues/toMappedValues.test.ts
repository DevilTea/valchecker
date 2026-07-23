import type { InferOperationMode, InferOutput } from '../../core'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createValchecker, map, number, string, toMappedValues } from '../..'

const v = createValchecker({ steps: [map, number, string, toMappedValues] })

describe('toMappedValues step plugin', () => {
	it('maps a snapshot of the current Map pipeline value with key, index, and thisArg', () => {
		const context = { offset: 10 }
		const input = new Map([['a', 1], ['b', 2]])
		const visited: string[] = []
		let callbackMap: Map<string, number> | undefined
		const schema = v.map({ key: v.string(), value: v.number() })
			.toMappedValues(function (this: typeof context, entryValue, key, index, value) {
				visited.push(key)
				callbackMap ??= value
				expect(value)
					.toBe(callbackMap)
				if (index === 0)
					value.set('c', 3)
				return entryValue + index + this.offset
			}, { thisArg: context })

		expect(schema.execute(input))
			.toEqual({ value: new Map([['a', 11], ['b', 13]]) })
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
		const error = new Error('value mapper')
		const input = new Map([['a', 1], ['b', 2]])
		expect(v.map({ key: v.string(), value: v.number() })
			.toMappedValues((entryValue) => {
				if (entryValue === 2)
					throw error
				return entryValue
			}, { message: 'Value mapping failed' })
			.execute(input))
			.toEqual({
				issues: [{
					code: 'toMappedValues:callback_failed',
					category: 'operation',
					message: 'Value mapping failed',
					path: [],
					payload: { value: input, key: 'b', entryValue: 2, index: 1, error },
				}],
			})
	})

	it('preserves mapper promises as Map values instead of awaiting them', async () => {
		const result = v.map({ key: v.string(), value: v.number() })
			.toMappedValues(async value => value + 1)
			.execute(new Map([['a', 1]]))

		expect(result).not.toBeInstanceOf(Promise)
		const promise = (result as any).value.get('a')
		expect(promise)
			.toBeInstanceOf(Promise)
		await expect(promise).resolves.toBe(2)
	})
})
