import { describe, expect, it } from 'vitest'
import { createValchecker, isCuid2, string } from '../..'

const v = createValchecker({ steps: [string, isCuid2] })

const valid = [
	'tz4a98xxat96iws9zmbrgj3a',
	'abc123',
	// The shortest and longest accepted lengths: 2 and the 32-character cap.
	'ab',
	`a${'b'.repeat(31)}`,
]

const invalid = [
	'TZ4A',
	'1abc',
	'a',
	'a_b',
	'',
	// One character past the cap. A cuid2 configured longer than 32 is not
	// accepted, which is the pattern's stated pragmatic limit.
	`a${'b'.repeat(32)}`,
	// Lowercase only, with no `i` flag: a single uppercase character anywhere
	// disqualifies the string.
	'abcD',
	// Hyphens are not part of base 36, so a Nano ID is not a CUID2.
	'a-b',
	// `$` without the `m` flag is end-of-input.
	'abc123\n',
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
