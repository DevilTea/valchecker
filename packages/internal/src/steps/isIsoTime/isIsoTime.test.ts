import { describe, expect, it } from 'vitest'
import { createValchecker, isIsoTime, string } from '../..'

const v = createValchecker({ steps: [string, isIsoTime] })

// The field ranges are part of the pattern now, so each one needs a case on
// both sides of its edge, and the anchors need cases of their own.
const valid = [
	'00:00:00',
	'23:59:59',
	'12:30:45.123',
	'19:00:00', // hour in the 10-19 alternative
	'20:00:00', // hour in the 20-23 alternative
	'23:00:00',
	'00:59:59',
	'12:30:45.5',
	'12:30:45.000000000',
]

const invalid = [
	'24:00:00',
	'12:60:00',
	'12:00:61',
	'1:00:00',
	'12:00',
	'',
	'12:00:60',
	'30:00:00',
	'12:30:45.', // fractional marker with no digits
	'12:30:45Z', // an offset belongs to isIsoDateTime, not here
	'12:30:45+01:00',
	' 12:30:45',
	'12:30:45 ',
	'123045',
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
			.execute('24:00:00'))
			.toEqual({
				issues: [{
					code: 'isIsoTime:expected_iso_time',
					category: 'validation',
					message: 'Expected a valid ISO 8601 time.',
					path: [],
					payload: { value: '24:00:00' },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.string()
			.isIsoTime({ message: 'Custom' })
			.execute('24:00:00'))
			.toMatchObject({ issues: [{ message: 'Custom' }] })
	})
})
