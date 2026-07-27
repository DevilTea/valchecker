import { describe, expect, it } from 'vitest'
import { createValchecker, isIsoDate, string } from '../..'

const v = createValchecker({ steps: [string, isIsoDate] })

const valid = [
	'2026-07-23',
	'2000-02-29',
	'2024-12-31',
	'0000-01-01',
	'0050-06-15',
	'0099-12-31',
	// The calendar rules now live in the validator's pattern.
	'2024-02-29',
	'0004-02-29',
	'0000-02-28',
	'2026-02-28',
	'2026-01-31',
	'2026-04-30',
]

const invalid = [
	'2026-02-30',
	'2026-13-01',
	'2026-00-10',
	'2026-1-1',
	'2023-02-29',
	'',
	'1900-02-29',
	// `0000` is a leap year in the proleptic Gregorian calendar, but the previous
	// implementation rejected this date through a `Date.UTC` roll-over and the
	// accepted set is deliberately unchanged.
	'0000-02-29',
	'2026-04-31', // day 31 in a 30-day month
	'2026-01-32', // day beyond every month's length
	'2026-07-00',
	'20260723',
]

describe('isIsoDate step plugin', () => {
	it.each(valid)('accepts %o', (input) => {
		expect(v.string()
			.isIsoDate()
			.execute(input))
			.toEqual({ value: input })
	})

	it.each(invalid)('rejects %o', (input) => {
		expect(v.string()
			.isIsoDate()
			.execute(input))
			.toMatchObject({ issues: [{ code: 'isIsoDate:expected_iso_date' }] })
	})

	it('reports the owned issue shape', () => {
		expect(v.string()
			.isIsoDate()
			.execute('2026-02-30'))
			.toEqual({
				issues: [{
					code: 'isIsoDate:expected_iso_date',
					category: 'validation',
					message: 'Expected a valid ISO 8601 date.',
					path: [],
					payload: { value: '2026-02-30' },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.string()
			.isIsoDate({ message: 'Custom' })
			.execute('2026-02-30'))
			.toMatchObject({ issues: [{ message: 'Custom' }] })
	})
})
