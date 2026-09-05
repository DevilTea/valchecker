import { describe, expect, it } from 'vitest'
import { createValchecker, isIsoDateTime, string } from '../..'

const v = createValchecker({ steps: [string, isIsoDateTime] })

const valid = [
	'2026-07-23T12:30:00Z',
	'2026-07-23T12:30:00',
	'2026-07-23T12:30:00.500+02:00',
	'2026-07-23T12:30:00,500+02:00',
	'2026-07-23T00:00:00-05:00',
	'0000-01-01T00:00:00Z',
	'0050-06-15T12:30:00',
	'0099-12-31T23:59:59Z',
	// Calendar and range boundaries. The calendar rules live in the shared
	// grammar, so each rule needs a case on both sides of its boundary.
	'2024-02-29T00:00:00Z', // leap year
	'2000-02-29T00:00:00Z', // leap century
	'0004-02-29T00:00:00Z',
	'0000-02-28T00:00:00Z',
	'0000-02-29T00:00:00Z', // year zero is divisible by 400
	'2026-01-31T23:59:59Z', // 31-day month
	'2026-04-30T00:00:00Z', // 30-day month
	'2026-02-28T00:00:00Z',
	'2026-07-23T23:59:59.123456789+23:59',
	'2026-07-23T23:59:59,123456789+23:59',
	'2026-07-23T12:30:00-00:00',
	// ISO 8601-1:2019/Amd 1:2022 end-of-day expressions. A decimal fraction is
	// valid only when it contains zeroes, because the expression denotes an
	// instant rather than a fraction of a 24th hour.
	'2026-07-23T24:00:00',
	'2026-07-23T24:00:00Z',
	'2026-07-23T24:00:00.000+02:00',
	'2026-07-23T24:00:00,000-05:00',
]

const invalid = [
	'2026-02-30T12:00:00',
	'2026-07-23 12:30:00',
	'2026-07-23T24:00:01',
	'2026-07-23T24:01:00',
	'2026-07-23T24:00:00.001Z',
	'2026-07-23T24:00:00,001Z',
	'2026-07-23T12:30:00+25:00',
	'not-a-date',
	'',
	'2023-02-29T00:00:00Z', // not a leap year
	'1900-02-29T00:00:00Z', // divisible by 100 but not 400
	'2026-04-31T00:00:00Z', // day 31 in a 30-day month
	'2026-01-32T00:00:00Z', // day beyond every month's length
	'2026-13-01T00:00:00Z',
	'2026-00-10T00:00:00Z',
	'2026-07-00T00:00:00Z',
	'2026-07-23T12:60:00Z',
	'2016-12-31T23:59:60Z', // leap-second notation is intentionally excluded
	'2026-07-23T12:30:60Z',
	'2026-07-23T12:30:00+23:60',
	'2026-07-23T12:30:00+24:00', // end-of-day hour never widens UTC offsets
	'2026-07-23T12:30:00-24:00',
	'2026-07-23T12:30:00.Z', // fractional marker with no digits
	'2026-07-23T12:30:00,Z',
	'20260723T123000Z', // basic representation is outside the bounded profile
	'2026-204T12:30:00Z', // ordinal dates are outside the profile
	'2026-W30-4T12:30:00Z', // week dates are outside the profile
	'2026-07-23T12:30Z', // reduced precision is outside the profile
	'+02026-07-23T12:30:00Z', // expanded/signed year is outside the profile
	'2026-07-23t12:30:00Z',
	' 2026-07-23T12:30:00Z',
	'2026-07-23T12:30:00Z ',
	// `$` is end of input, not end of line.
	'2026-07-23T12:30:00Z\nbad',
	'bad\n2026-07-23T12:30:00Z',
]

describe('isIsoDateTime step plugin', () => {
	it.each(valid)('accepts %o', (input) => {
		expect(v.string()
			.isIsoDateTime()
			.execute(input))
			.toEqual({ value: input })
	})

	it.each(invalid)('rejects %o', (input) => {
		expect(v.string()
			.isIsoDateTime()
			.execute(input))
			.toMatchObject({ issues: [{ code: 'isIsoDateTime:expected_iso_date_time' }] })
	})

	it('reports the owned issue shape', () => {
		expect(v.string()
			.isIsoDateTime()
			.execute('2026-02-30T12:00:00'))
			.toEqual({
				issues: [{
					code: 'isIsoDateTime:expected_iso_date_time',
					category: 'validation',
					message: 'Expected a supported ISO 8601 calendar date-time.',
					path: [],
					payload: { value: '2026-02-30T12:00:00' },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.string()
			.isIsoDateTime({ message: 'Custom' })
			.execute('2026-02-30T12:00:00'))
			.toMatchObject({ issues: [{ message: 'Custom' }] })
	})
})
