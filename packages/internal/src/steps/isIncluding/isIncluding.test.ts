import { describe, expect, it } from 'vitest'
import { array, createValchecker, isIncluding, number, set, string } from '../..'

const v = createValchecker({ steps: [array, isIncluding, number, set, string] })

describe('isIncluding step plugin', () => {
	it('checks string inclusion with a starting position', () => {
		expect(v.string()
			.isIncluding('ab', { position: 2 })
			.execute('xxab'))
			.toEqual({ value: 'xxab' })
		expect(v.string()
			.isIncluding('ab', { position: 3 })
			.execute('xxab'))
			.toMatchObject({ issues: [{ payload: { target: 'string', expected: 'ab', position: 3 } }] })
	})

	it('uses SameValueZero array inclusion with fromIndex', () => {
		expect(v.array(v.number())
			.isIncluding(Number.NaN)
			.execute([1, Number.NaN]))
			.toEqual({ value: [1, Number.NaN] })
		expect(v.array(v.number())
			.isIncluding(1, { fromIndex: 1, message: 'Missing item' })
			.execute([1]))
			.toMatchObject({ issues: [{ message: 'Missing item', payload: { target: 'array', expected: 1, fromIndex: 1 } }] })
	})

	it('uses native Set SameValueZero membership', () => {
		const nanSet = new Set([Number.NaN])
		const zeroSet = new Set([0])
		expect(v.set(v.number())
			.isIncluding(Number.NaN)
			.execute(nanSet))
			.toEqual({ value: nanSet })
		expect(v.set(v.number())
			.isIncluding(-0)
			.execute(zeroSet))
			.toEqual({ value: zeroSet })
	})

	it('reports the Set payload variant and custom message', () => {
		const value = new Set([1])
		expect(v.set(v.number())
			.isIncluding(2, { message: 'Missing Set item' })
			.execute(value))
			.toEqual({
				issues: [{
					code: 'isIncluding:expected_including',
					category: 'validation',
					message: 'Missing Set item',
					path: [],
					payload: { target: 'set', value, expected: 2 },
				}],
			})
	})
})
