import { describe, expect, it } from 'vitest'
import { createValchecker, string, toTrimmedEnd } from '../..'

const v = createValchecker({ steps: [string, toTrimmedEnd] })

const schema = v.string()
	.toTrimmedEnd()

// One representative per mechanism of the whitespace set `String.prototype.trimEnd`
// removes; `toTrimmed` enumerates that set in full.
const trimmed = [
	{ label: 'U+0009 tab', pad: '\t' },
	{ label: 'U+000A line feed', pad: '\n' },
	{ label: 'U+0020 space', pad: ' ' },
	{ label: 'U+00A0 no-break space', pad: ' ' },
	{ label: 'U+2028 line separator', pad: ' ' },
	{ label: 'U+3000 ideographic space', pad: '\u3000' },
	{ label: 'U+FEFF zero width no-break space', pad: '\uFEFF' },
]

// Not members of that set: U+180E left it in Unicode 6.3, and the other two are
// format characters that were never in it.
const kept = [
	{ label: 'U+180E mongolian vowel separator', pad: '\u180E' },
	{ label: 'U+200B zero width space', pad: '\u200B' },
	{ label: 'U+2060 word joiner', pad: '\u2060' },
]

describe('toTrimmedEnd step plugin', () => {
	it('removes trailing whitespace and leaves the leading whitespace in place', () => {
		expect(schema.execute('  hello  '))
			.toEqual({ value: '  hello' })
		expect(schema.execute(' \t\n hello \t\n '))
			.toEqual({ value: ' \t\n hello' })
	})

	it('leaves a string with no trailing whitespace unchanged', () => {
		expect(schema.execute('hello'))
			.toEqual({ value: 'hello' })
		expect(schema.execute('  hello'))
			.toEqual({ value: '  hello' })
	})

	it('returns the empty string for an all-whitespace input and for the empty string', () => {
		expect(schema.execute(' \t\n\r '))
			.toEqual({ value: '' })
		expect(schema.execute(''))
			.toEqual({ value: '' })
	})

	it.each(trimmed)('trims a trailing $label and keeps the leading one', ({ pad }) => {
		expect(schema.execute(`${pad}x${pad}`))
			.toEqual({ value: `${pad}x` })
	})

	it.each(kept)('keeps a trailing $label, which is not whitespace to trim', ({ pad }) => {
		expect(schema.execute(`x${pad}`))
			.toEqual({ value: `x${pad}` })
	})

	it('stops at the last non-whitespace code unit without splitting a surrogate pair', () => {
		expect(schema.execute(' \u{1F44D} '))
			.toEqual({ value: ' \u{1F44D}' })
	})
})
