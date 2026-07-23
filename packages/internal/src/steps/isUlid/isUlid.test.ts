import { describe, expect, it } from 'vitest'
import { createValchecker, isUlid, string } from '../..'

const v = createValchecker({ steps: [string, isUlid] })

const valid = [
	'01ARZ3NDEKTSV4RRFFQ69G5FAV',
	'7ZZZZZZZZZZZZZZZZZZZZZZZZZ',
]

const invalid = [
	'01ARZ3NDEKTSV4RRFFQ69G5FA',
	'01ARZ3NDEKTSV4RRFFQ69G5FAI',
	'not a ulid',
	'',
]

describe('isUlid step plugin', () => {
	it.each(valid)('accepts %o', (input) => {
		expect(v.string()
			.isUlid()
			.execute(input))
			.toEqual({ value: input })
	})

	it.each(invalid)('rejects %o', (input) => {
		expect(v.string()
			.isUlid()
			.execute(input))
			.toMatchObject({ issues: [{ code: 'isUlid:expected_ulid' }] })
	})

	it('reports the owned issue shape', () => {
		expect(v.string()
			.isUlid()
			.execute('01ARZ3NDEKTSV4RRFFQ69G5FA'))
			.toEqual({
				issues: [{
					code: 'isUlid:expected_ulid',
					category: 'validation',
					message: 'Expected a valid ULID.',
					path: [],
					payload: { value: '01ARZ3NDEKTSV4RRFFQ69G5FA' },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.string()
			.isUlid({ message: 'Custom' })
			.execute('01ARZ3NDEKTSV4RRFFQ69G5FA'))
			.toMatchObject({ issues: [{ message: 'Custom' }] })
	})
})
