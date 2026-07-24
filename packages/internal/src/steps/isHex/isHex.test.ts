import { describe, expect, it } from 'vitest'
import { createValchecker, isHex, string } from '../..'

const v = createValchecker({ steps: [string, isHex] })

const valid = [
	'deadBEEF',
	'0',
	'abcdef0123456789',
]

const invalid = [
	'0x1f',
	'xyz',
	'gg',
	'',
]

describe('isHex step plugin', () => {
	it.each(valid)('accepts %o', (input) => {
		expect(v.string()
			.isHex()
			.execute(input))
			.toEqual({ value: input })
	})

	it.each(invalid)('rejects %o', (input) => {
		expect(v.string()
			.isHex()
			.execute(input))
			.toMatchObject({ issues: [{ code: 'isHex:expected_hex' }] })
	})

	it('reports the owned issue shape', () => {
		expect(v.string()
			.isHex()
			.execute('xyz'))
			.toEqual({
				issues: [{
					code: 'isHex:expected_hex',
					category: 'validation',
					message: 'Expected a hexadecimal string.',
					path: [],
					payload: { value: 'xyz' },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.string()
			.isHex({ message: 'Custom' })
			.execute('xyz'))
			.toMatchObject({ issues: [{ message: 'Custom' }] })
	})
})
