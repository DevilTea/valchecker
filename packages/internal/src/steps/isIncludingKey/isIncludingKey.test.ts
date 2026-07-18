import { describe, expect, it } from 'vitest'
import { createValchecker, isIncludingKey, map, number, string } from '../..'

const v = createValchecker({ steps: [isIncludingKey, map, number, string] })

describe('isIncludingKey step plugin', () => {
	it('uses native Map SameValueZero key membership', () => {
		const nanMap = new Map([[Number.NaN, 'value']])
		const zeroMap = new Map([[0, 'value']])
		expect(v.map({ key: v.number(), value: v.string() }).isIncludingKey(Number.NaN).execute(nanMap)).toEqual({ value: nanMap })
		expect(v.map({ key: v.number(), value: v.string() }).isIncludingKey(-0).execute(zeroMap)).toEqual({ value: zeroMap })
	})

	it('reports the expected key and supports custom messages', () => {
		const value = new Map([['a', 1]])
		expect(v.map({ key: v.string(), value: v.number() }).isIncludingKey('b', { message: 'Missing key' }).execute(value)).toEqual({
			issues: [{
				code: 'isIncludingKey:expected_including_key',
				category: 'validation',
				message: 'Missing key',
				path: [],
				payload: { value, expectedKey: 'b' },
			}],
		})
	})
})
