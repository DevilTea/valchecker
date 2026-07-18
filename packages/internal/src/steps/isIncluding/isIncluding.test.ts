import { describe, expect, it } from 'vitest'
import { array, createValchecker, isIncluding, number, string } from '../..'
const v = createValchecker({ steps: [array, isIncluding, number, string] })
describe('isIncluding step plugin', () => {
	it('checks string inclusion with a starting position', () => {
		expect(v.string().isIncluding('ab', { position: 2 }).execute('xxab')).toEqual({ value: 'xxab' })
		expect(v.string().isIncluding('ab', { position: 3 }).execute('xxab')).toMatchObject({ issues: [{ payload: { target: 'string', position: 3 } }] })
	})
	it('uses SameValueZero array inclusion with fromIndex', () => {
		expect(v.array(v.number()).isIncluding(Number.NaN).execute([1, Number.NaN])).toEqual({ value: [1, Number.NaN] })
		expect(v.array(v.number()).isIncluding(1, { fromIndex: 1, message: 'Missing item' }).execute([1])).toMatchObject({ issues: [{ message: 'Missing item', payload: { target: 'array', expected: 1, fromIndex: 1 } }] })
	})
})
