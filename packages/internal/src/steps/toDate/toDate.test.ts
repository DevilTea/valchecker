import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createValchecker, number, string, toDate, unknown } from '../..'

const v = createValchecker({ steps: [number, string, toDate, unknown] })

describe('toDate step plugin', () => {
	it('converts epoch milliseconds, including 0, to a Date', () => {
		expect(v.number()
			.toDate()
			.execute(0))
			.toEqual({ value: new Date(0) })
	})

	it('converts an ISO string to a Date', () => {
		expect(v.string()
			.toDate()
			.execute('2020-01-01T00:00:00.000Z'))
			.toEqual({ value: new Date('2020-01-01T00:00:00.000Z') })
	})

	it.each([
		['unparseable string', 'nope'],
		['empty string', ''],
	] as const)('reports an Invalid Date from an %s with no error', (_label, value) => {
		const result = v.string()
			.toDate()
			.execute(value)
		expect(result)
			.toEqual({
				issues: [{
					code: 'toDate:conversion_failed',
					category: 'operation',
					message: 'Expected a value convertible to a valid Date.',
					path: [],
					payload: { value, error: undefined },
				}],
			})
	})

	it('reports an Invalid Date from NaN', () => {
		expect(v.number()
			.toDate()
			.execute(Number.NaN))
			.toMatchObject({
				issues: [{ code: 'toDate:conversion_failed', payload: { value: Number.NaN, error: undefined } }],
			})
	})

	it('reports a native exception thrown by new Date()', () => {
		// A bigint reaches `new Date()` only through a deliberate type bypass
		// (`toDate` is unavailable after `unknown`); `new Date(bigint)` throws,
		// exercising the defensive catch branch.
		const result = (v.unknown() as any)
			.toDate()
			.execute(10n)
		expect(result)
			.toMatchObject({
				issues: [{ code: 'toDate:conversion_failed', category: 'operation', payload: { value: 10n } }],
			})
		expect(result.issues[0].payload.error)
			.toBeInstanceOf(TypeError)
	})

	it('supports custom messages', () => {
		expect(v.string()
			.toDate({ message: 'Custom date conversion' })
			.execute('nope'))
			.toMatchObject({ issues: [{ message: 'Custom date conversion' }] })
	})

	it('infers a Date output', () => {
		const _schema = v.string()
			.toDate()
		expectTypeOf<InferOutput<typeof _schema>>()
			.toEqualTypeOf<Date>()
	})
})
