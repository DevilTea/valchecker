import { describe, expect, it } from 'vitest'
import { createValchecker, isEndingWith, string } from '../..'

const v = createValchecker({ steps: [string, isEndingWith] })

describe('isEndingWith step plugin', () => {
	it('accepts matching suffixes', () => {
		expect(v.string()
			.isEndingWith('.txt')
			.execute('file.txt'))
			.toEqual({ value: 'file.txt' })
	})

	it.each([
		// `''.endsWith('')` is true, so the empty suffix accepts every string
		// including the empty one, and no non-empty policy is added.
		['the empty suffix against a non-empty string', '', 'file.txt'],
		['the empty suffix against the empty string', '', ''],
		// A suffix equal to the whole string is still a suffix.
		['a suffix equal to the whole string', 'file.txt', 'file.txt'],
		// The comparison is over UTF-16 code units, so a lone low surrogate is a
		// suffix of the astral character it closes. No code-point boundary is
		// enforced.
		['a lone low surrogate splitting a surrogate pair', '\uDE00', 'a😀'],
	])('accepts %s', (_label, suffix, input) => {
		expect(v.string()
			.isEndingWith(suffix)
			.execute(input))
			.toEqual({ value: input })
	})

	it.each([
		// A suffix longer than the string cannot match, whatever it ends with.
		['a suffix longer than the string', 'file.txt', 'e.txt'],
		// No case folding.
		['a suffix differing only in case', '.txt', 'file.TXT'],
		// The suffix is anchored at the end, not searched for.
		['a suffix occurring earlier in the string', '.txt', 'file.txt.bak'],
	])('rejects %s', (_label, suffix, input) => {
		expect(v.string()
			.isEndingWith(suffix)
			.execute(input))
			.toMatchObject({ issues: [{ code: 'isEndingWith:expected_ending_with' }] })
	})

	it('rejects non-matching suffixes', () => {
		expect(v.string()
			.isEndingWith('.txt')
			.execute('file.md'))
			.toEqual({
				issues: [{
					code: 'isEndingWith:expected_ending_with',
					category: 'validation',
					message: 'Expected the string to end with ".txt".',
					path: [],
					payload: { value: 'file.md', suffix: '.txt' },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.string()
			.isEndingWith('.txt', { message: 'Custom suffix' })
			.execute('file.md'))
			.toMatchObject({
				issues: [{ message: 'Custom suffix' }],
			})
	})
})
