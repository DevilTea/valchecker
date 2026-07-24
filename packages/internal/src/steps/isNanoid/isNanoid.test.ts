import { describe, expect, it } from 'vitest'
import { createValchecker, isNanoid, string } from '../..'

const v = createValchecker({ steps: [string, isNanoid] })

const valid = [
	'V1StGXR8_Z5jdHi6B-myT',
	'abc',
	'a_b-c',
]

const invalid = [
	'abc def',
	'abc+',
	'a/b',
	'',
]

describe('isNanoid step plugin', () => {
	it.each(valid)('accepts %o', (input) => {
		expect(v.string()
			.isNanoid()
			.execute(input))
			.toEqual({ value: input })
	})

	it.each(invalid)('rejects %o', (input) => {
		expect(v.string()
			.isNanoid()
			.execute(input))
			.toMatchObject({ issues: [{ code: 'isNanoid:expected_nanoid' }] })
	})

	it('reports the owned issue shape', () => {
		expect(v.string()
			.isNanoid()
			.execute('abc def'))
			.toEqual({
				issues: [{
					code: 'isNanoid:expected_nanoid',
					category: 'validation',
					message: 'Expected a valid Nano ID.',
					path: [],
					payload: { value: 'abc def' },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.string()
			.isNanoid({ message: 'Custom' })
			.execute('abc def'))
			.toMatchObject({ issues: [{ message: 'Custom' }] })
	})
})
