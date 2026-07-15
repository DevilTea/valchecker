import { describe, expect, it } from 'vitest'
import { createValchecker, intersection, number, transform, unknown } from '../..'

const v = createValchecker({ steps: [intersection, number, transform, unknown] })

describe('intersection coverage contracts', () => {
	it('returns the input for an empty branch list', () => {
		expect(v.intersection([]).execute('value'))
			.toEqual({ value: 'value' })
	})

	it('returns an asynchronous branch failure without merging outputs', async () => {
		const result = v.intersection([
			v.unknown().transform(async value => ({ value })),
			v.number(),
		]).execute('invalid')

		await expect(result)
			.resolves.toMatchObject({
				issues: [{ code: 'number:expected_number' }],
			})
	})
})
