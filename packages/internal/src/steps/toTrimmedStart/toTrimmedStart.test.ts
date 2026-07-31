import { describe, expect, it } from 'vitest'
import { createValchecker, string, toTrimmedStart } from '../..'

const v = createValchecker({ steps: [string, toTrimmedStart] })

const schema = v.string()
	.toTrimmedStart()

// One representative per mechanism of the whitespace set `String.prototype.trimStart`
// removes; `toTrimmed` enumerates that set in full.
const trimmed = [
	{ label: 'U+0009 tab', pad: '\t' },
	{ label: 'U+000A line feed', pad: '\n' },
	{ label: 'U+0020 space', pad: ' ' },
	{ label: 'U+00A0 no-break space', pad: '\u00A0' },
	{ label: 'U+2028 line separator', pad: '\u2028' },
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

describe('toTrimmedStart step plugin', () => {
	it('removes leading whitespace and leaves the trailing whitespace in place', () => {
		expect(schema.execute('  hello  '))
			.toEqual({ value: 'hello  ' })
		expect(schema.execute(' \t\n hello \t\n '))
			.toEqual({ value: 'hello \t\n ' })
	})

	it('leaves a string with no leading whitespace unchanged', () => {
		expect(schema.execute('hello'))
			.toEqual({ value: 'hello' })
		expect(schema.execute('hello  '))
			.toEqual({ value: 'hello  ' })
	})

	it('returns the empty string for an all-whitespace input and for the empty string', () => {
		expect(schema.execute(' \t\n\r '))
			.toEqual({ value: '' })
		expect(schema.execute(''))
			.toEqual({ value: '' })
	})

	it.each(trimmed)('trims a leading $label and keeps the trailing one', ({ pad }) => {
		expect(schema.execute(`${pad}x${pad}`))
			.toEqual({ value: `x${pad}` })
	})

	it.each(kept)('keeps a leading $label, which is not whitespace to trim', ({ pad }) => {
		expect(schema.execute(`${pad}x`))
			.toEqual({ value: `${pad}x` })
	})

	it('stops at the first non-whitespace code unit without splitting a surrogate pair', () => {
		expect(schema.execute(' \u{1F44D} '))
			.toEqual({ value: '\u{1F44D} ' })
	})
})
