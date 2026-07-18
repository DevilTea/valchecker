import { describe, expect, it } from 'vitest'
import { createValchecker, intersection, number, transform, unknown } from '../..'

const v = createValchecker({ steps: [intersection, number, transform, unknown] })

describe('intersection asynchronous branch contracts', () => {
	it('returns an asynchronous branch failure without merging partial outputs', async () => {
		const result = v.intersection([
			v.unknown().transform(async value => ({ value })),
			v.number(),
		]).execute('invalid')

		expect(result).toBeInstanceOf(Promise)
		await expect(result).resolves.toMatchObject({
			issues: [{
				code: 'number:expected_number',
				payload: { value: 'invalid' },
			}],
		})
	})
})
