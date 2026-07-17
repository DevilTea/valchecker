import { describe, expect, it } from 'vitest'
import { array, createValchecker, isEmpty, number, string } from '../..'

const v = createValchecker({ steps: [string, number, array, isEmpty] })

describe('isEmpty step plugin', () => {
	it.each([
		[v.string().isEmpty(), ''],
		[v.array(v.number()).isEmpty(), []],
	] as const)('accepts empty values', (schema, value) => {
		expect(schema.execute(value as never)).toEqual({ value })
	})

	it('rejects non-empty values', () => {
		expect(v.string().isEmpty().execute('x')).toEqual({
			issues: [{
				code: 'isEmpty:expected_empty',
				category: 'validation',
				message: 'Expected an empty value.',
				path: [],
				payload: { length: expect.any(Number), value: 'x' },
			}],
		})
	})

	it('supports custom messages', () => {
		expect(v.string().isEmpty('Custom empty').execute('x')).toMatchObject({
			issues: [{ message: 'Custom empty' }],
		})
	})
})
