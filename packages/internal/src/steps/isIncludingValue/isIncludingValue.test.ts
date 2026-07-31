import { describe, expect, it } from 'vitest'
import { createValchecker, isIncludingValue, map, number, string } from '../..'

const v = createValchecker({ steps: [isIncludingValue, map, number, string] })

describe('isIncludingValue step plugin', () => {
	it('uses SameValueZero value membership without allocating an intermediate array', () => {
		const nanMap = new Map([['value', Number.NaN]])
		const zeroMap = new Map([['value', 0]])
		expect(v.map({ key: v.string(), value: v.number() })
			.isIncludingValue(Number.NaN)
			.execute(nanMap))
			.toEqual({ value: nanMap })
		expect(v.map({ key: v.string(), value: v.number() })
			.isIncludingValue(-0)
			.execute(zeroMap))
			.toEqual({ value: zeroMap })
		// SameValueZero is an equality, not a NaN wildcard: a NaN entry matches only
		// a NaN expected value, and a NaN expected value matches only a NaN entry.
		expect(v.map({ key: v.string(), value: v.number() })
			.isIncludingValue(1)
			.execute(nanMap))
			.toMatchObject({
				issues: [{
					code: 'isIncludingValue:expected_including_value',
					message: 'Expected the Map to include the configured value.',
				}],
			})
		expect(v.map({ key: v.string(), value: v.number() })
			.isIncludingValue(Number.NaN)
			.execute(zeroMap))
			.toMatchObject({ issues: [{ code: 'isIncludingValue:expected_including_value' }] })
	})

	it('reports the expected value and supports custom messages', () => {
		const value = new Map([['a', 1]])
		expect(v.map({ key: v.string(), value: v.number() })
			.isIncludingValue(2, { message: 'Missing value' })
			.execute(value))
			.toEqual({
				issues: [{
					code: 'isIncludingValue:expected_including_value',
					category: 'validation',
					message: 'Missing value',
					path: [],
					payload: { value, expectedValue: 2 },
				}],
			})
	})
})
