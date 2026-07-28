import { describe, expect, it } from 'vitest'
import { createValchecker, isHex, string } from '../..'

const v = createValchecker({ steps: [string, isHex] })

const valid = [
	'deadBEEF',
	'0',
	'abcdef0123456789',
	// No even-length policy: one, three and five digits are all accepted, so a
	// caller wanting whole bytes composes a length check.
	'abc',
	// Either case, and the digits and letters may be mixed freely.
	'ABCDEF',
]

const invalid = [
	'0x1f',
	'xyz',
	'gg',
	'',
	// The prefix is rejected in either case, and with a sign.
	'0X1F',
	'-1f',
	'#1f',
	// No whitespace is trimmed, and `$` without the `m` flag is end-of-input.
	' 1f',
	'1f\n',
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
