import { describe, expect, it } from 'vitest'
import { createValchecker, isCuid2, string } from '../..'

const v = createValchecker({ steps: [string, isCuid2] })

const valid = [
	'tz4a98xxat96iws9zmbrgj3a',
	'abc123',
]

const invalid = [
	'TZ4A',
	'1abc',
	'a',
	'a_b',
	'',
]

describe('isCuid2 step plugin', () => {
	it.each(valid)('accepts %o', (input) => {
		expect(v.string()
			.isCuid2()
			.execute(input))
			.toEqual({ value: input })
	})

	it.each(invalid)('rejects %o', (input) => {
		expect(v.string()
			.isCuid2()
			.execute(input))
			.toMatchObject({ issues: [{ code: 'isCuid2:expected_cuid2' }] })
	})

	it('reports the owned issue shape', () => {
		expect(v.string()
			.isCuid2()
			.execute('1abc'))
			.toEqual({
				issues: [{
					code: 'isCuid2:expected_cuid2',
					category: 'validation',
					message: 'Expected a valid CUID2.',
					path: [],
					payload: { value: '1abc' },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.string()
			.isCuid2({ message: 'Custom' })
			.execute('1abc'))
			.toMatchObject({ issues: [{ message: 'Custom' }] })
	})
})
