import { describe, expect, it } from 'vitest'
import { createValchecker, isStartingWith, string } from '../..'

const v = createValchecker({ steps: [string, isStartingWith] })

describe('isStartingWith step plugin', () => {
	it('accepts matching prefixes', () => {
		expect(v.string()
			.isStartingWith('hello')
			.execute('hello world'))
			.toEqual({ value: 'hello world' })
	})

	it.each([
		// `''.startsWith('')` is true, so the empty prefix accepts every string
		// including the empty one, and no non-empty policy is added.
		['the empty prefix against a non-empty string', '', 'hello'],
		['the empty prefix against the empty string', '', ''],
		// A prefix equal to the whole string is still a prefix.
		['a prefix equal to the whole string', 'hello', 'hello'],
		// The comparison is over UTF-16 code units, so a lone high surrogate is
		// a prefix of the astral character it opens. No code-point boundary is
		// enforced.
		['a lone high surrogate splitting a surrogate pair', '\uD83D', '😀a'],
	])('accepts %s', (_label, prefix, input) => {
		expect(v.string()
			.isStartingWith(prefix)
			.execute(input))
			.toEqual({ value: input })
	})

	it.each([
		// A prefix longer than the string cannot match, whatever it starts with.
		['a prefix longer than the string', 'hello', 'hell'],
		// No case folding.
		['a prefix differing only in case', 'hello', 'Hello world'],
		// No Unicode normalization: the precomposed U+00E9 is not the decomposed
		// `e` + U+0301 sequence, though the two render identically. Written as
		// escapes so an editor cannot silently normalize one into the other.
		['a precomposed prefix against a decomposed string', '\u00E9', 'e\u0301clair'],
		// The prefix is anchored at position 0, not searched for.
		['a prefix occurring later in the string', 'world', 'hello world'],
	])('rejects %s', (_label, prefix, input) => {
		expect(v.string()
			.isStartingWith(prefix)
			.execute(input))
			.toMatchObject({ issues: [{ code: 'isStartingWith:expected_starting_with' }] })
	})

	it('rejects non-matching prefixes', () => {
		expect(v.string()
			.isStartingWith('hello')
			.execute('world'))
			.toEqual({
				issues: [{
					code: 'isStartingWith:expected_starting_with',
					category: 'validation',
					message: 'Expected the string to start with "hello".',
					path: [],
					payload: { value: 'world', prefix: 'hello' },
				}],
			})
	})

	it('supports custom messages', () => {
		expect(v.string()
			.isStartingWith('x', { message: 'Custom prefix' })
			.execute('value'))
			.toMatchObject({
				issues: [{ message: 'Custom prefix' }],
			})
	})
})
