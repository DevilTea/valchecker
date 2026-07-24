import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createValchecker, date } from '../..'

const v = createValchecker({ steps: [date] })

describe('date step plugin', () => {
	it.each([
		new Date(0),
		new Date('2020-01-01T00:00:00.000Z'),
		new Date(Date.now()),
	])('accepts a valid Date %s', (value) => {
		expect(v.date()
			.execute(value))
			.toEqual({ value })
	})

	it.each([
		['string', '2020-01-01'],
		['number', 0],
		['null', null],
		['plain object', {}],
	] as const)('rejects non-Date %s', (_label, value) => {
		expect(v.date()
			.execute(value))
			.toEqual({
				issues: [{
					code: 'date:expected_date',
					category: 'validation',
					message: 'Expected a Date.',
					path: [],
					payload: { value },
				}],
			})
	})

	it('rejects an Invalid Date', () => {
		const value = new Date('nope')
		expect(v.date()
			.execute(value))
			.toEqual({
				issues: [{
					code: 'date:invalid_date',
					category: 'validation',
					message: 'Expected a valid Date.',
					path: [],
					payload: { value },
				}],
			})
	})

	it('supports custom messages for both owned issues', () => {
		expect(v.date({ message: () => 'Custom date message' })
			.execute('nope'))
			.toMatchObject({ issues: [{ code: 'date:expected_date', message: 'Custom date message' }] })
		expect(v.date({ message: () => 'Custom date message' })
			.execute(new Date('nope')))
			.toMatchObject({ issues: [{ code: 'date:invalid_date', message: 'Custom date message' }] })
	})

	it('infers a Date output', () => {
		const _schema = v.date()
		expectTypeOf<InferOutput<typeof _schema>>()
			.toEqualTypeOf<Date>()
	})
})
