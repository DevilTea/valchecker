import { describe, expect, it } from 'vitest'
import { createValchecker, date, isAfter } from '../..'

const v = createValchecker({ steps: [date, isAfter] })
const bound = new Date('2020-01-01T00:00:00.000Z')

describe('isAfter step plugin', () => {
	it('accepts a date strictly after the bound and preserves it', () => {
		const value = new Date('2020-01-02T00:00:00.000Z')
		expect(v.date()
			.isAfter(bound)
			.execute(value))
			.toEqual({ value })
	})

	it.each([
		['equal to the bound', new Date('2020-01-01T00:00:00.000Z')],
		['before the bound', new Date('2019-12-31T00:00:00.000Z')],
	] as const)('rejects a date %s', (_label, value) => {
		expect(v.date()
			.isAfter(bound)
			.execute(value))
			.toEqual({
				issues: [{
					code: 'isAfter:expected_after',
					category: 'validation',
					message: `Expected a date after ${bound.toISOString()}.`,
					path: [],
					payload: { value, bound },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.date()
			.isAfter(bound, { message: 'Too early' })
			.execute(bound))
			.toMatchObject({ issues: [{ message: 'Too early' }] })
	})

	it('reports the owned issue instead of throwing when the bound is an Invalid Date', () => {
		const value = new Date('2020-01-02T00:00:00.000Z')
		const invalidBound = new Date('invalid')
		expect(v.date()
			.isAfter(invalidBound)
			.execute(value))
			.toEqual({
				issues: [{
					code: 'isAfter:expected_after',
					category: 'validation',
					message: 'Expected a date after Invalid Date.',
					path: [],
					payload: { value, bound: invalidBound },
				}],
			})
	})
})
