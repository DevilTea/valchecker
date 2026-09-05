import { describe, expect, it } from 'vitest'
import { createValchecker, isIsoTime, string } from '../..'

const v = createValchecker({ steps: [string, isIsoTime] })

const valid = [
	'00:00:00',
	'23:59:59',
	'24:00:00', // end-of-day instant
	'24:00:00.000',
	'24:00:00,000',
	'12:30:45.123',
	'12:30:45,123',
	'19:00:00', // hour in the 10-19 alternative
	'20:00:00', // hour in the 20-23 alternative
	'23:00:00',
	'00:59:59',
	'12:30:45.5',
	'12:30:45,5',
	'12:30:45.000000000',
]

const invalid = [
	'24:00:01',
	'24:01:00',
	'24:00:00.001', // end-of-day fractions may contain only zeroes
	'24:00:00,001',
	'12:60:00',
	'12:00:61',
	'1:00:00',
	'12:00', // reduced precision is outside this bounded profile
	'',
	'12:00:60', // leap seconds are intentionally outside this profile
	'30:00:00',
	'12:30:45.', // fractional marker with no digits
	'12:30:45,',
	'12:30:45Z', // a timezone belongs to isIsoDateTime, not here
	'12:30:45+01:00',
	' 12:30:45',
	'12:30:45 ',
	'123045', // basic format is outside this bounded profile
	// `$` is end of input, not end of line: a valid time embedded in a longer
	// string must stay rejected if the pattern ever gains the `m` flag.
	'12:30:45\nbad',
	'bad\n12:30:45',
	'12:30:45\n24:00:00',
]

describe('isIsoTime step plugin', () => {
	it.each(valid)('accepts %o', (input) => {
		expect(v.string()
			.isIsoTime()
			.execute(input))
			.toEqual({ value: input })
	})

	it.each(invalid)('rejects %o', (input) => {
		expect(v.string()
			.isIsoTime()
			.execute(input))
			.toMatchObject({ issues: [{ code: 'isIsoTime:expected_iso_time' }] })
	})

	it('reports the owned issue shape', () => {
		expect(v.string()
			.isIsoTime()
			.execute('24:00:01'))
			.toEqual({
				issues: [{
					code: 'isIsoTime:expected_iso_time',
					category: 'validation',
					message: 'Expected a supported ISO 8601 time of day.',
					path: [],
					payload: { value: '24:00:01' },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.string()
			.isIsoTime({ message: 'Custom' })
			.execute('24:00:01'))
			.toMatchObject({ issues: [{ message: 'Custom' }] })
	})
})
