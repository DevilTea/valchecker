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

	it('snapshots a mutable bound and diagnostic payloads', () => {
		const configuredBound = new Date('2020-01-02T00:00:00.000Z')
		const schema = v.date()
			.isBefore(configuredBound)
		configuredBound.setTime(Date.parse('2020-01-01T00:00:00.000Z'))

		const accepted = new Date('2020-01-01T12:00:00.000Z')
		expect(schema.execute(accepted))
			.toEqual({ value: accepted })

		const rejected = new Date('2020-01-03T00:00:00.000Z')
		const firstFailure = schema.execute(rejected)
		expect(firstFailure)
			.toEqual({
				issues: [{
					code: 'isBefore:expected_before',
					category: 'validation',
					message: 'Expected a date before 2020-01-02T00:00:00.000Z.',
					path: [],
					payload: { value: rejected, bound: new Date('2020-01-02T00:00:00.000Z') },
				}],
			})
		if (!v.isFailure(firstFailure))
			throw new Error('Expected a failure result.')
		const issue = firstFailure.issues[0]!
		if (issue.code !== 'isBefore:expected_before')
			throw new Error(`Unexpected issue: ${issue.code}`)
		issue.payload.bound.setTime(Date.parse('2020-01-04T00:00:00.000Z'))

		expect(schema.execute(rejected))
			.toEqual({
				issues: [{
					code: 'isBefore:expected_before',
					category: 'validation',
					message: 'Expected a date before 2020-01-02T00:00:00.000Z.',
					path: [],
					payload: { value: rejected, bound: new Date('2020-01-02T00:00:00.000Z') },
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
		const configuredBound = new DiagnosticDate('2020-01-02T00:00:00.000Z')
		const schema = v.date()
			.isBefore(configuredBound)
		configuredBound.setTime(Date.parse('2020-01-01T00:00:00.000Z'))

		expect(schema.execute(new Date('2020-01-03T00:00:00.000Z')))
			.toMatchObject({
				issues: [{ message: 'Expected a date before Overridden 2020-01-02T00:00:00.000Z.' }],
			})
		expect(diagnosticCalls)
			.toBe(1)
	})

	it('reports the owned issue instead of throwing when the bound is an Invalid Date', () => {
		const value = new Date('2020-01-01T00:00:00.000Z')
		const invalidBound = new Date('invalid')
		expect(v.date()
			.isBefore(invalidBound)
			.execute(value))
			.toEqual({
				issues: [{
					code: 'isBefore:expected_before',
					category: 'validation',
					message: 'Expected a date before Invalid Date.',
					path: [],
					payload: { value, bound: invalidBound },
				}],
			})
	})
})
