import { describe, expect, it } from 'vitest'
import { createValchecker, isIsoTime, string } from '../..'

const v = createValchecker({ steps: [string, isIsoTime] })

const valid = [
	'00:00:00',
	'23:59:59',
	'12:30:45.123',
]

const invalid = [
	'24:00:00',
	'12:60:00',
	'12:00:61',
	'1:00:00',
	'12:00',
	'',
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
