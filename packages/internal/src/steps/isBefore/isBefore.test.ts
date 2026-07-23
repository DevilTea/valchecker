import { describe, expect, it } from 'vitest'
import { createValchecker, date, isBefore } from '../..'

const v = createValchecker({ steps: [date, isBefore] })
const bound = new Date('2020-01-02T00:00:00.000Z')

describe('isBefore step plugin', () => {
	it('accepts a date strictly before the bound and preserves it', () => {
		const value = new Date('2020-01-01T00:00:00.000Z')
		expect(v.date()
			.isBefore(bound)
			.execute(value))
			.toEqual({ value })
	})

	it.each([
		['equal to the bound', new Date('2020-01-02T00:00:00.000Z')],
		['after the bound', new Date('2020-01-03T00:00:00.000Z')],
	] as const)('rejects a date %s', (_label, value) => {
		expect(v.date()
			.isBefore(bound)
			.execute(value))
			.toEqual({
				issues: [{
					code: 'isBefore:expected_before',
					category: 'validation',
					message: `Expected a date before ${bound.toISOString()}.`,
					path: [],
					payload: { value, bound },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.date()
			.isBefore(bound, { message: 'Too late' })
			.execute(bound))
			.toMatchObject({ issues: [{ message: 'Too late' }] })
	})
})
