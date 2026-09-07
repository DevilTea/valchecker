import { describe, expect, it } from 'vitest'
import { createValchecker, isUlid, string } from '../..'

const v = createValchecker({ steps: [string, isUlid] })

const valid = [
	'01ARZ3NDEKTSV4RRFFQ69G5FAV',
	'7ZZZZZZZZZZZZZZZZZZZZZZZZZ',
	// Crockford base32 is defined in upper case, but matching is
	// case-insensitive, so the lowercase form of a ULID is accepted too.
	'01arz3ndektsv4rrffq69g5fav',
]

const invalid = [
	'01ARZ3NDEKTSV4RRFFQ69G5FA',
	'01ARZ3NDEKTSV4RRFFQ69G5FAI',
	'not a ulid',
	'',
	// Exactly 26 characters: 25 above, 27 here.
	'01ARZ3NDEKTSV4RRFFQ69G5FAVV',
	// Crockford base32 excludes I, L, O and U to avoid transcription errors,
	// and the case-insensitive flag excludes their lowercase forms with them.
	'01ARZ3NDEKTSV4RRFFQ69G5FAL',
	'01ARZ3NDEKTSV4RRFFQ69G5FAO',
	'01ARZ3NDEKTSV4RRFFQ69G5FAU',
	'01ARZ3NDEKTSV4RRFFQ69G5FAi',
	// The first base32 character carries only four significant bits in a
	// canonical 128-bit ULID, so values beginning with 8 or a later letter
	// overflow even when all 26 characters use the Crockford alphabet.
	'8ZZZZZZZZZZZZZZZZZZZZZZZZZ',
	'ZZZZZZZZZZZZZZZZZZZZZZZZZZ',
	// `$` without the `m` flag is end-of-input, so a 26-character ULID with a
	// trailing newline is 27 characters and fails.
	'01ARZ3NDEKTSV4RRFFQ69G5FAV\n',
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
