import { describe, expect, it } from 'vitest'
import { createValchecker, string, toNormalized } from '../..'

const v = createValchecker({ steps: [string, toNormalized] })
describe('toNormalized step plugin', () => {
	it('normalizes to NFC by default and supports an explicit form', () => {
		// The composed and decomposed spellings of the same grapheme are distinct
		// strings of different lengths; each form maps to exactly one of them.
		const decomposed = 'é'
		const composed = 'é'
		expect(decomposed).not.toBe(composed)
		expect(decomposed)
			.toHaveLength(2)

		expect(v.string()
			.toNormalized()
			.execute(decomposed))
			.toEqual({ value: composed })
		expect(v.string()
			.toNormalized({ form: 'NFD' })
			.execute(composed))
			.toEqual({ value: decomposed })
	})
	it.each([
		// Only the compatibility forms fold the U+FB01 ligature into 'fi'.
		['NFC', 'ﬁ'],
		['NFD', 'ﬁ'],
		['NFKC', 'fi'],
		['NFKD', 'fi'],
	] as const)('applies the %s form', (form, expected) => {
		expect(v.string()
			.toNormalized({ form })
			.execute('ﬁ'))
			.toEqual({ value: expected })
	})
	it('throws a TypeError while constructing the schema for a form outside NFC, NFD, NFKC, and NFKD', () => {
		expect(() => v.string()
			.toNormalized({ form: 'INVALID' as any }))
			.toThrow(new TypeError('toNormalized() form must be NFC, NFD, NFKC, or NFKD.'))
	})
})
