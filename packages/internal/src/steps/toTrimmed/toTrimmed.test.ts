import { describe, expect, it } from 'vitest'
import { createValchecker, string, toTrimmed } from '../..'

const v = createValchecker({ steps: [string, toTrimmed] })

const schema = v.string()
	.toTrimmed()

// `String.prototype.trim` removes the ECMAScript `WhiteSpace` production plus
// `LineTerminator`: the four format controls, every `Space_Separator` code point,
// the two separators, and U+FEFF. One representative per mechanism; enumerating
// U+2000..U+200A would repeat the `Space_Separator` case ten times.
const trimmed = [
	{ label: 'U+0009 tab', pad: '\t' },
	{ label: 'U+000A line feed', pad: '\n' },
	{ label: 'U+000B vertical tab', pad: '\v' },
	{ label: 'U+000C form feed', pad: '\f' },
	{ label: 'U+000D carriage return', pad: '\r' },
	{ label: 'U+0020 space', pad: ' ' },
	{ label: 'U+00A0 no-break space', pad: '\u00A0' },
	{ label: 'U+1680 ogham space mark', pad: '\u1680' },
	{ label: 'U+2000 en quad', pad: '\u2000' },
	{ label: 'U+2028 line separator', pad: '\u2028' },
	{ label: 'U+2029 paragraph separator', pad: '\u2029' },
	{ label: 'U+202F narrow no-break space', pad: '\u202F' },
	{ label: 'U+205F medium mathematical space', pad: '\u205F' },
	{ label: 'U+3000 ideographic space', pad: '\u3000' },
	{ label: 'U+FEFF zero width no-break space', pad: '\uFEFF' },
]

// Invisible, and each one a documented non-member of that production: U+180E left
// the whitespace set in Unicode 6.3, and the other two are format characters that
// were never in it.
const kept = [
	{ label: 'U+180E mongolian vowel separator', pad: '\u180E' },
	{ label: 'U+200B zero width space', pad: '\u200B' },
	{ label: 'U+2060 word joiner', pad: '\u2060' },
]

describe('toTrimmed step plugin', () => {
	it('removes whitespace from both ends and preserves the interior', () => {
		expect(schema.execute('  hello   world  '))
			.toEqual({ value: 'hello   world' })
	})

	it('leaves a string with no surrounding whitespace unchanged', () => {
		expect(schema.execute('hello'))
			.toEqual({ value: 'hello' })
	})

	it('returns the empty string for an all-whitespace input and for the empty string', () => {
		expect(schema.execute(' \t\n\r '))
			.toEqual({ value: '' })
		expect(schema.execute(''))
			.toEqual({ value: '' })
	})

	it.each(trimmed)('trims $label', ({ pad }) => {
		expect(schema.execute(`${pad}x${pad}`))
			.toEqual({ value: 'x' })
	})

	it.each(kept)('keeps $label, which is not whitespace to trim', ({ pad }) => {
		expect(schema.execute(`${pad}x${pad}`))
			.toEqual({ value: `${pad}x${pad}` })
	})

	it('does not normalize or re-encode the characters it keeps', () => {
		// A decomposed sequence stays decomposed and a surrogate pair stays
		// paired: trimming is neither a normalization nor a code-point rewrite.
		expect(schema.execute(' e\u0301 '))
			.toEqual({ value: 'e\u0301' })
		expect(schema.execute(' \u{1F44D} '))
			.toEqual({ value: '\u{1F44D}' })
	})
})
