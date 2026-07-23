import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { any, array, createValchecker, toSorted, transform } from '../..'

const v = createValchecker({ steps: [array, any, toSorted, transform] })

describe('toSorted step plugin', () => {
	it('uses native default ordering and leaves the input unchanged', () => {
		const input = ['banana', 'apple', 'cherry']
		const schema = v.array(v.any())
			.toSorted()
		const result = schema.execute(input)

		expect(result)
			.toEqual({ value: ['apple', 'banana', 'cherry'] })
		expect(input)
			.toEqual(['banana', 'apple', 'cherry'])
		if (v.isSuccess(result))
			expect(result.value).not.toBe(input)
		expectTypeOf<InferOutput<typeof schema>>()
			.toEqualTypeOf<any[]>()
	})

	it('uses a custom comparator without changing duplicate membership', () => {
		expect(v.array(v.any())
			.toSorted({ compareFn: (left: number, right: number) => right - left })
			.execute([3, 1, 4, 1, 5]))
			.toEqual({
				value: [5, 4, 3, 1, 1],
			})
	})

	it.each([
		['empty', []],
		['single', [42]],
	] as const)('preserves the %s-array boundary', (_case, input) => {
		expect(v.array(v.any())
			.toSorted()
			.execute([...input]))
			.toEqual({ value: input })
	})

	it('reports comparator exceptions with both operands', () => {
		const error = new Error('comparator')
		const result = v.array(v.any())
			.toSorted({ compareFn: () => { throw error }, message: 'Sort failed' })
			.execute([2, 1])

		expect(result)
			.toMatchObject({
				issues: [{
					code: 'toSorted:callback_failed',
					category: 'operation',
					message: 'Sort failed',
					path: [],
					payload: {
						value: [2, 1],
						left: expect.any(Number),
						right: expect.any(Number),
						error,
					},
				}],
			})
	})

	it('leaves failures outside the comparator callback to the core boundary', () => {
		const error = new Error('sort method')
		const value = [] as any[] & { toSorted: typeof Array.prototype.toSorted }
		value.toSorted = () => {
			throw error
		}

		expect(v.transform(() => value)
			.toSorted({ compareFn: () => 0 })
			.execute(null))
			.toMatchObject({
				issues: [{
					code: 'core:unknown_exception',
					category: 'internal',
					payload: { error },
				}],
			})
	})
})
