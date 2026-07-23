import { describe, expect, it } from 'vitest'
import { any, array, createValchecker, isLengthExactly, number, string } from '../..'

const v = createValchecker({ steps: [any, array, isLengthExactly, number, string] })

describe('isLengthExactly step plugin', () => {
	it('accepts strings and arrays with the expected length', () => {
		expect(v.string()
			.isLengthExactly(3)
			.execute('abc'))
			.toEqual({ value: 'abc' })
		expect(v.array(v.number())
			.isLengthExactly(2)
			.execute([1, 2]))
			.toEqual({ value: [1, 2] })
	})

	it('reports the observed and expected lengths', () => {
		expect(v.string()
			.isLengthExactly(3)
			.execute('ab'))
			.toEqual({
				issues: [{
					code: 'isLengthExactly:expected_length_exactly',
					category: 'validation',
					message: 'Expected a length of exactly 3.',
					path: [],
					payload: { value: 'ab', expectedLength: 3, length: 2 },
				}],
			})
	})

	it('reads a dynamic length once and supports custom messages', () => {
		let reads = 0
		const value = { get length() {
			reads++
			return 1
		} }
		const result = v.any()
			.isLengthExactly(2, { message: 'Exact length required' })
			.execute(value)
		expect(reads)
			.toBe(1)
		expect(result)
			.toMatchObject({ issues: [{ message: 'Exact length required', payload: { length: 1 } }] })
	})
})
