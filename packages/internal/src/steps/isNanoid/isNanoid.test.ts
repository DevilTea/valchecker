import { describe, expect, it } from 'vitest'
import { createValchecker, isNanoid, string } from '../..'

const v = createValchecker({ steps: [string, isNanoid] })

const valid = [
	'V1StGXR8_Z5jdHi6B-myT',
	'abc',
	'a_b-c',
	// No length is imposed above one character, because Nano ID size is chosen
	// at generation time: a single character and a 64-character ID both pass.
	'a',
	'a'.repeat(64),
	// `_` and `-` are the two non-alphanumeric characters of the default
	// alphabet, and either case of letter is accepted.
	'-_',
	'AbC123',
]

const invalid = [
	'abc def',
	'abc+',
	'a/b',
	'',
	// `+` and `/` belong to base64, not to the Nano ID alphabet, and `=` to
	// neither.
	'a=b',
	// `.` and `~` are URL-safe but are not in the default alphabet.
	'a.b',
	'a~b',
	// `$` without the `m` flag is end-of-input.
	'abc\n',
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
