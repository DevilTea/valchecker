import { describe, expect, it } from 'vitest'
import { createValchecker, isSizeExactly, map, number, set, string } from '../..'

const v = createValchecker({ steps: [isSizeExactly, map, number, set, string] })

describe('isSizeExactly step plugin', () => {
	it('preserves values with the configured exact size', () => {
		const value = new Set(['a'])
		expect(v.set(v.string()).isSizeExactly(1).execute(value)).toEqual({ value })
	})

	it('reports the observed and expected sizes', () => {
		const value = new Map([['a', 1]])
		expect(v.map({ key: v.string(), value: v.number() }).isSizeExactly(2, { message: 'Wrong size' }).execute(value)).toEqual({
			issues: [{
				code: 'isSizeExactly:expected_size_exactly',
				category: 'validation',
				message: 'Wrong size',
				path: [],
				payload: { value, expectedSize: 2, size: 1 },
			}],
		})
	})

	it('uses exact numeric equality without hidden policy', () => {
		expect(v.set(v.string()).isSizeExactly(Number.POSITIVE_INFINITY).execute(new Set())).toMatchObject({
			issues: [{ payload: { expectedSize: Number.POSITIVE_INFINITY, size: 0 } }],
		})
	})
})
