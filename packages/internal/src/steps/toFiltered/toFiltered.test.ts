import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { any, array, createValchecker, toFiltered, transform } from '../..'

const v = createValchecker({ steps: [array, any, toFiltered, transform] })

describe('toFiltered step plugin', () => {
	it('filters with item and index while leaving the input unchanged', () => {
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
	] as const)('handles the %s-result boundary', (mode, input, expected) => {
		const predicate = mode === 'all' ? () => true : () => false
		expect(v.array(v.any())
			.toFiltered(predicate)
			.execute([...input]))
			.toEqual({ value: expected })
	})

	it('reports predicate exceptions with the current item and index', () => {
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

	it('leaves failures outside the predicate callback to the core boundary', () => {
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
})
