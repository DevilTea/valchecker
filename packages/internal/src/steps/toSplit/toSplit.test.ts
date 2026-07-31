import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createValchecker, number, string, toSplit } from '../..'

const v = createValchecker({ steps: [number, string, toSplit] })

describe('toSplit step plugin', () => {
	it('splits with a string separator', () => {
		expect(v.string()
			.toSplit(',')
			.execute('a,b,c'))
			.toEqual({ value: ['a', 'b', 'c'] })
	})

	it('forwards the limit parameter', () => {
		expect(v.string()
			.toSplit(',', 2)
			.execute('a,b,c'))
			.toEqual({ value: ['a', 'b'] })
	})

	it('supports regular expression separators', () => {
		expect(v.string()
			.toSplit(/\s+/)
			.execute('a b c'))
			.toEqual({ value: ['a', 'b', 'c'] })
	})

	it.each([
		// Native split never drops the whole string when the separator is absent,
		// and it yields one empty string rather than an empty array for `''`.
		['abc', ',', ['abc']],
		['', ',', ['']],
		['abc', '', ['a', 'b', 'c']],
		// The empty separator on the empty string is the one case that yields no element.
		['', '', []],
	] as const)('splits %j on %j exactly as String.prototype.split does', (input, separator, expected) => {
		expect(v.string()
			.toSplit(separator)
			.execute(input))
			.toEqual({ value: expected })
	})

	it('forwards a limit of 0 as an empty result', () => {
		expect(v.string()
			.toSplit(',', 0)
			.execute('a,b,c'))
			.toEqual({ value: [] })
	})

	it('infers a string array and is unavailable outside a string output', () => {
		const _schema = v.string()
			.toSplit(',')
		expectTypeOf<InferOutput<typeof _schema>>()
			.toEqualTypeOf<string[]>()
		if (false) {
			// @ts-expect-error toSplit is unavailable when the output has no split method
			v.number().toSplit(',') // eslint-disable-line style/newline-per-chained-call -- single line keeps the directive covering the whole unreachable negative-type expression
		}
	})
})
