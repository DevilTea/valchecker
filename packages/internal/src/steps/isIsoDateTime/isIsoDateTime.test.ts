import { describe, expect, it } from 'vitest'
import { createValchecker, isIsoDateTime, string } from '../..'

const v = createValchecker({ steps: [string, isIsoDateTime] })

const valid = [
	'2026-07-23T12:30:00Z',
	'2026-07-23T12:30:00',
	'2026-07-23T12:30:00.500+02:00',
	'2026-07-23T00:00:00-05:00',
]

const invalid = [
	'2026-02-30T12:00:00',
	'2026-07-23 12:30:00',
	'2026-07-23T24:00:00',
	'2026-07-23T12:30:00+25:00',
	'not-a-date',
	'',
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
					message: 'Expected a valid ISO 8601 date-time.',
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
