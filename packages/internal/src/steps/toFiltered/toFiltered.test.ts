import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { any, array, createValchecker, set, toFiltered, transform } from '../..'

const v = createValchecker({ steps: [array, any, set, toFiltered, transform] })

describe('toFiltered step plugin', () => {
	it('filters arrays with item and index while leaving the input unchanged', () => {
		const input = [1, 2, 3, 4, 5]
		const schema = v.array(v.any())
			.toFiltered((item: number, index) => item > 2 && index % 2 === 0)
		const result = schema.execute(input)

		expect(result)
			.toEqual({ value: [3, 5] })
		expect(input)
			.toEqual([1, 2, 3, 4, 5])
		if (v.isSuccess(result))
			expect(result.value).not.toBe(input)
		expectTypeOf<InferOutput<typeof schema>>()
			.toEqualTypeOf<any[]>()
	})

	it.each([
		['empty', [], []],
		['none', [1, 2, 3], []],
		['all', [1, 2, 3], [1, 2, 3]],
	] as const)('handles the array %s-result boundary', (mode, input, expected) => {
		const predicate = mode === 'all' ? () => true : () => false
		expect(v.array(v.any())
			.toFiltered(predicate)
			.execute([...input]))
			.toEqual({ value: expected })
	})

	it('reports array predicate exceptions with the current item and index', () => {
		const error = new Error('predicate')
		const result = v.array(v.any())
			.toFiltered((_item: number, index) => {
				if (index === 1)
					throw error
				return true
			}, { message: 'Filter failed' })
			.execute([1, 2, 3])

		expect(result)
			.toEqual({
				issues: [{
					code: 'toFiltered:callback_failed',
					category: 'operation',
					message: 'Filter failed',
					path: [],
					payload: { value: [1, 2, 3], item: 2, index: 1, error },
				}],
			})
	})

	it('leaves failures outside the array predicate callback to the core boundary', () => {
		const error = new Error('filter method')
		const value = [] as any[] & { filter: typeof Array.prototype.filter }
		value.filter = () => { throw error }

		expect(v.transform(() => value)
			.toFiltered(() => true)
			.execute(null))
			.toMatchObject({
				issues: [{
					code: 'core:unknown_exception',
					category: 'internal',
					payload: { error },
				}],
			})
	})

	it('filters a snapshot of Set items with index, source Set, and thisArg', () => {
		const context = { minimum: 2 }
		const input = new Set([1, 2, 3])
		const visited: number[] = []
		const schema = v.set(v.any()).toFiltered(function (item: number, index, value) {
			visited.push(item)
			expect(value).toBe(input)
			if (index === 0)
				input.add(4)
			return item >= this.minimum
		}, { thisArg: context })

		expect(schema.execute(input)).toEqual({ value: new Set([2, 3]) })
		expect(visited).toEqual([1, 2, 3])
	})

	it('narrows filtered Set item types through a predicate type guard', () => {
		const schema = v.set(v.any()).toFiltered((item): item is string => typeof item === 'string')
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<Set<string>>()
		expect(schema.execute(new Set<unknown>(['a', 1, 'b']))).toEqual({ value: new Set(['a', 'b']) })
	})

	it('reports Set predicate exceptions with the current item and index', () => {
		const error = new Error('set predicate')
		const input = new Set([1, 2, 3])
		expect(v.set(v.any()).toFiltered((_item: number, index) => {
			if (index === 1)
				throw error
			return true
		}, { message: 'Set filter failed' }).execute(input)).toEqual({
			issues: [{
				code: 'toFiltered:callback_failed',
				category: 'operation',
				message: 'Set filter failed',
				path: [],
				payload: { value: input, item: 2, index: 1, error },
			}],
		})
	})

	it('treats returned promises as synchronous truthy predicate results', () => {
		const input = new Set([1, 2])
		const result = v.set(v.any()).toFiltered(async () => false).execute(input)
		expect(result).not.toBeInstanceOf(Promise)
		expect(result).toEqual({ value: input })
	})
})
