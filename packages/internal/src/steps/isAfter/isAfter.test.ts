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

	it('snapshots a mutable bound and diagnostic payloads', () => {
		const configuredBound = new Date('2020-01-01T00:00:00.000Z')
		const schema = v.date()
			.isAfter(configuredBound)
		configuredBound.setTime(Date.parse('2020-01-03T00:00:00.000Z'))

		const accepted = new Date('2020-01-02T12:00:00.000Z')
		expect(schema.execute(accepted))
			.toEqual({ value: accepted })

		const rejected = new Date('2019-12-31T00:00:00.000Z')
		const firstFailure = schema.execute(rejected)
		expect(firstFailure)
			.toEqual({
				issues: [{
					code: 'isAfter:expected_after',
					category: 'validation',
					message: 'Expected a date after 2020-01-01T00:00:00.000Z.',
					path: [],
					payload: { value: rejected, bound: new Date('2020-01-01T00:00:00.000Z') },
				}],
			})
		if (!v.isFailure(firstFailure))
			throw new Error('Expected a failure result.')
		const issue = firstFailure.issues[0]!
		if (issue.code !== 'isAfter:expected_after')
			throw new Error(`Unexpected issue: ${issue.code}`)
		issue.payload.bound.setTime(Date.parse('2019-12-30T00:00:00.000Z'))

		expect(schema.execute(rejected))
			.toEqual({
				issues: [{
					code: 'isAfter:expected_after',
					category: 'validation',
					message: 'Expected a date after 2020-01-01T00:00:00.000Z.',
					path: [],
					payload: { value: rejected, bound: new Date('2020-01-01T00:00:00.000Z') },
				}],
			})
	})

	it('snapshots overridden diagnostic text before the bound mutates', () => {
		let diagnosticCalls = 0
		class DiagnosticDate extends Date {
			override toISOString() {
				diagnosticCalls += 1
				return `Overridden ${super.toISOString()}`
			}
		}
		const configuredBound = new DiagnosticDate('2020-01-01T00:00:00.000Z')
		const schema = v.date()
			.isAfter(configuredBound)
		configuredBound.setTime(Date.parse('2020-01-03T00:00:00.000Z'))

		expect(schema.execute(new Date('2019-12-31T00:00:00.000Z')))
			.toMatchObject({
				issues: [{ message: 'Expected a date after Overridden 2020-01-01T00:00:00.000Z.' }],
			})
		expect(diagnosticCalls)
			.toBe(1)
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
