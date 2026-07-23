import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { array, createValchecker, number, set, toMapped, transform, unknown } from '../..'

const v = createValchecker({ steps: [array, number, set, toMapped, transform, unknown] })

describe('toMapped step plugin', () => {
	it('maps array items with index, source array, and thisArg', () => {
		const context = { offset: 10 }
		const input = [1, 2]
		let callbackArray: readonly number[] | undefined
		const schema = v.array(v.number())
			.toMapped(function (this: typeof context, item, index, value) {
				callbackArray ??= value
				expect(value)
					.toBe(callbackArray)
				expect(value)
					.toEqual(input)
				return item + index + this.offset
			}, { thisArg: context })
		expect(schema.execute(input))
			.toEqual({ value: [11, 13] })
		expectTypeOf<InferOutput<typeof schema>>()
			.toEqualTypeOf<number[]>()
	})

	it('converts array callback exceptions into an operation issue', () => {
		const error = new Error('boom')
		const input = [1, 2]
		expect(v.array(v.number())
			.toMapped((item) => {
				if (item === 2)
					throw error
				return item
			}, { message: 'Mapping failed' })
			.execute(input))
			.toMatchObject({
				issues: [{
					code: 'toMapped:callback_failed',
					category: 'operation',
					message: 'Mapping failed',
					payload: { value: input, item: 2, index: 1, error },
				}],
			})
	})

	it('preserves mapper promises as array items instead of awaiting them', async () => {
		const result = v.array(v.number())
			.toMapped(async item => item + 1)
			.execute([1])
		expect(result).not.toBeInstanceOf(Promise)
		const promise = (result as any).value[0]
		expect(promise)
			.toBeInstanceOf(Promise)
		await expect(promise).resolves.toBe(2)
	})

	it('leaves failures outside the array mapper callback to the core boundary', () => {
		const error = new Error('map method')
		const input = [1] as number[]
		Object.defineProperty(input, 'map', {
			value: () => { throw error },
		})
		const schema = v.unknown()
			.transform(() => input)
			.toMapped(item => item)
		expect(schema.execute(null))
			.toMatchObject({
				issues: [{ code: 'core:unknown_exception', payload: { error } }],
			})
	})

	it('maps a snapshot of the current Set pipeline value with index and thisArg', () => {
		const context = { offset: 10 }
		const input = new Set([1, 2])
		const visited: number[] = []
		let callbackSet: Set<number> | undefined
		const schema = v.set(v.number())
			.toMapped(function (this: typeof context, item, index, value) {
				visited.push(item)
				callbackSet ??= value
				expect(value)
					.toBe(callbackSet)
				if (index === 0)
					value.add(3)
				return item + index + this.offset
			}, { thisArg: context })

		expect(schema.execute(input))
			.toEqual({ value: new Set([11, 13]) })
		expect(input)
			.toEqual(new Set([1, 2]))
		expect(callbackSet)
			.toEqual(new Set([1, 2, 3]))
		expect(visited)
			.toEqual([1, 2])
		expectTypeOf<InferOutput<typeof schema>>()
			.toEqualTypeOf<Set<number>>()
	})

	it('converts Set callback exceptions into an operation issue', () => {
		const error = new Error('set mapper')
		const input = new Set([1, 2])
		expect(v.set(v.number())
			.toMapped((item) => {
				if (item === 2)
					throw error
				return item
			}, { message: 'Set mapping failed' })
			.execute(input))
			.toEqual({
				issues: [{
					code: 'toMapped:callback_failed',
					category: 'operation',
					message: 'Set mapping failed',
					path: [],
					payload: { value: input, item: 2, index: 1, error },
				}],
			})
	})

	it('rejects SameValueZero collisions between mapped Set items', () => {
		const input = new Set([1, 2])
		expect(v.set(v.number())
			.toMapped(() => Number.NaN, {
				message: issue => `set:${issue.code}`,
			})
			.execute(input))
			.toEqual({
				issues: [{
					code: 'toMapped:duplicate_mapped_item',
					category: 'validation',
					message: 'set:toMapped:duplicate_mapped_item',
					path: [],
					payload: {
						value: input,
						firstItem: 1,
						item: 2,
						mappedItem: Number.NaN,
						firstIndex: 0,
						index: 1,
					},
				}],
			})
	})

	it('preserves mapper promises as Set items instead of awaiting them', async () => {
		const result = v.set(v.number())
			.toMapped(async item => item + 1)
			.execute(new Set([1]))
		expect(result).not.toBeInstanceOf(Promise)
		const promise = [...(result as any).value][0]
		expect(promise)
			.toBeInstanceOf(Promise)
		await expect(promise).resolves.toBe(2)
	})
})
