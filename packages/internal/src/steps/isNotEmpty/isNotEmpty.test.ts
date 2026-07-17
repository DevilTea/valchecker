import { describe, expect, it } from 'vitest'
import { array, createValchecker, isNotEmpty, number, string } from '../..'

const v = createValchecker({ steps: [string, number, array, isNotEmpty] })

describe('isNotEmpty step plugin', () => {
	it('accepts non-empty strings and arrays', () => {
		expect(v.string().isNotEmpty().execute('value')).toEqual({ value: 'value' })
		expect(v.array(v.number()).isNotEmpty().execute([1])).toEqual({ value: [1] })
	})

	it('rejects empty values', () => {
		expect(v.string().isNotEmpty().execute('')).toEqual({
			issues: [{
				code: 'isNotEmpty:expected_not_empty',
				category: 'validation',
				message: 'Expected a non-empty value.',
				path: [],
				payload: { length: expect.any(Number), value: '' },
			}],
		})
	})

	it('supports custom messages', () => {
		expect(v.string().isNotEmpty('Custom non-empty').execute('')).toMatchObject({
			issues: [{ message: 'Custom non-empty' }],
		})
	})
})
