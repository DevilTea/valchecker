import { describe, expect, it } from 'vitest'
import { createValchecker, isMatching, string } from '../..'

const v = createValchecker({ steps: [isMatching, string] })

describe('isMatching step plugin', () => {
	it.each([
		// The check is `RegExp.prototype.test`, which searches: an unanchored
		// pattern matches anywhere in the string rather than the whole of it.
		['an unanchored pattern matches a substring', /oo/, 'food'],
		['an anchored pattern matches the whole string', /^\d+$/, '123'],
		['a flag from the pattern is honoured', /^FOO$/i, 'foo'],
		// The empty pattern matches at position 0 of every string.
		// eslint-disable-next-line regexp/no-empty-group -- `/(?:)/` is how an empty pattern is spelled as a literal, and the empty pattern is the case under test
		['the empty pattern matches everything', /(?:)/, ''],
	])('accepts %s', (_label, pattern, input) => {
		expect(v.string()
			.isMatching(pattern)
			.execute(input))
			.toEqual({ value: input })
	})

	it.each([
		['a pattern absent from the string', /oo/, 'bar'],
		['an anchored pattern against a longer string', /^\d+$/, '123a'],
		// Without `i` the comparison is case-sensitive.
		['a case difference without the i flag', /^FOO$/, 'foo'],
	])('rejects %s', (_label, pattern, input) => {
		expect(v.string()
			.isMatching(pattern)
			.execute(input))
			.toMatchObject({ issues: [{ code: 'isMatching:expected_matching' }] })
	})

	it('matches repeatedly without retaining regular-expression state', () => {
		const pattern = /foo/gi
		pattern.lastIndex = 99
		const schema = v.string()
			.isMatching(pattern)
		expect(schema.execute('FOO'))
			.toEqual({ value: 'FOO' })
		expect(schema.execute('FOO'))
			.toEqual({ value: 'FOO' })
	})

	it('keeps a sticky pattern anchored at position 0 on every execution', () => {
		const schema = v.string()
			.isMatching(/foo/y)
		expect(schema.execute('foobar'))
			.toEqual({ value: 'foobar' })
		expect(schema.execute('barfoo'))
			.toMatchObject({ issues: [{ code: 'isMatching:expected_matching' }] })
		expect(schema.execute('foobar'))
			.toEqual({ value: 'foobar' })
	})

	it('is unaffected by mutating the caller\'s RegExp after construction', () => {
		const pattern = /foo/g
		const schema = v.string()
			.isMatching(pattern)
		pattern.lastIndex = 99
		// `compile()` is the only way a caller can change a RegExp's source and
		// flags in place, so it is what the schema-time snapshot has to survive.
		pattern.compile('bar', 'gi')
		expect(schema.execute('foo'))
			.toEqual({ value: 'foo' })
		expect(schema.execute('bar'))
			.toMatchObject({
				issues: [{
					message: 'Expected the string to match /foo/g.',
					payload: { pattern: { source: 'foo', flags: 'g' } },
				}],
			})
	})

	it('reports the owned issue shape', () => {
		expect(v.string()
			.isMatching(/^foo$/i)
			.execute('bar'))
			.toEqual({
				issues: [{
					code: 'isMatching:expected_matching',
					category: 'validation',
					message: 'Expected the string to match /^foo$/i.',
					path: [],
					payload: { value: 'bar', pattern: { source: '^foo$', flags: 'i' } },
				}],
			})
	})

	it('reports the schema-time pattern snapshot and custom messages', () => {
		const failure = v.string()
			.isMatching(/^foo$/, { message: 'Pattern required' })
			.execute('bar') as any
		expect(failure)
			.toMatchObject({
				issues: [{
					message: 'Pattern required',
					payload: { value: 'bar', pattern: { source: '^foo$', flags: '' } },
				}],
			})
	})

	it('rejects non-RegExp patterns for JavaScript callers', () => {
		expect(() => v.string()
			.isMatching('foo' as any))
			.toThrow(TypeError)
	})
})
