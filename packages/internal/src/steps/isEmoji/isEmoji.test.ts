import { describe, expect, it, vi } from 'vitest'
import { createValchecker, isEmoji, string } from '../..'

const v = createValchecker({ steps: [string, isEmoji] })

const defaultSchema = v.string()
	.isEmoji()
const registeredSchema = v.string()
	.isEmoji({ registered: true })

const ZWJ = '\u{200D}'
const VS16 = '\u{FE0F}'
const COMBINING_KEYCAP = '\u{20E3}'
const TAG_TERM = '\u{E007F}'
function tag(text: string) {
	return [...text].map(character => String.fromCodePoint(0xE0000 + character.codePointAt(0)!))
		.join('')
}

interface Case {
	label: string
	input: string
	/** Whether the default accepted set — the UTS #51 grammar — accepts it. */
	byGrammar: boolean
	/** Whether `{ registered: true }` accepts it. */
	byRegistered: boolean
}

/**
 * One corpus, asserted against both accepted sets, so the inputs where the two
 * disagree are pinned here instead of being discovered by a consumer.
 *
 * Every row was executed against `\p{RGI_Emoji}`, against the grammar, and
 * against Valibot 1.4.2 while this was written; the divergences are explained in
 * the step's JSDoc and in `docs/api/formats.md`.
 */
const corpus: Case[] = [
	// Registered emoji: both paths accept.
	{ label: 'a single emoji-presentation character', input: '😀', byGrammar: true, byRegistered: true },
	{ label: 'several emoji in a row', input: '🎉🎊', byGrammar: true, byRegistered: true },
	{ label: 'a skin-tone modifier sequence', input: '👍🏽', byGrammar: true, byRegistered: true },
	{ label: 'a ZWJ family', input: `👨${ZWJ}👩${ZWJ}👧${ZWJ}👦`, byGrammar: true, byRegistered: true },
	{ label: 'a ZWJ sequence ending in a hair component', input: `👨${ZWJ}🦰`, byGrammar: true, byRegistered: true },
	{ label: 'a ZWJ sequence carrying a skin tone', input: `👨🏽${ZWJ}💻`, byGrammar: true, byRegistered: true },
	{ label: 'a flag sequence', input: '🇹🇼', byGrammar: true, byRegistered: true },
	{ label: 'two flag sequences', input: '🇹🇼🇯🇵', byGrammar: true, byRegistered: true },
	{ label: 'a tag sequence', input: `🏴${tag('gbeng')}${TAG_TERM}`, byGrammar: true, byRegistered: true },
	{ label: 'a keycap sequence', input: `1${VS16}${COMBINING_KEYCAP}`, byGrammar: true, byRegistered: true },
	{ label: 'a number-sign keycap sequence', input: `#${VS16}${COMBINING_KEYCAP}`, byGrammar: true, byRegistered: true },
	{ label: 'a text-presentation character with VS16', input: `❤${VS16}`, byGrammar: true, byRegistered: true },
	{ label: 'a VS16-qualified ZWJ sequence', input: `🏳${VS16}${ZWJ}🌈`, byGrammar: true, byRegistered: true },
	{ label: 'a Unicode 15 emoji', input: '🫨', byGrammar: true, byRegistered: true },
	{ label: 'a Unicode 15.1 ZWJ sequence', input: `🙂${ZWJ}↔${VS16}`, byGrammar: true, byRegistered: true },
	{ label: 'another Unicode 15.1 ZWJ sequence', input: `🐦${ZWJ}🔥`, byGrammar: true, byRegistered: true },
	{ label: 'a Unicode 16 emoji', input: '🫜', byGrammar: true, byRegistered: true },
	{ label: 'another Unicode 16 emoji', input: '🪉', byGrammar: true, byRegistered: true },
	{ label: 'a third Unicode 16 emoji', input: '🫟', byGrammar: true, byRegistered: true },

	// Structurally valid but unregistered: the default accepts, `registered` does not.
	{ label: 'a ZWJ chain of two registered emoji', input: `👍${ZWJ}👍`, byGrammar: true, byRegistered: false },
	{ label: 'another unregistered ZWJ chain', input: `😀${ZWJ}🚀`, byGrammar: true, byRegistered: false },
	{ label: 'a digit with VS16 and no combining keycap', input: `1${VS16}`, byGrammar: true, byRegistered: false },
	{ label: 'a regional indicator pair that is not a country', input: '🇦🇦', byGrammar: true, byRegistered: false },
	{ label: 'a redundant VS16 on an emoji-presentation character', input: `⌚${VS16}`, byGrammar: true, byRegistered: false },
	{ label: 'a tag sequence on an unregistered base', input: `😀${tag('gbeng')}${TAG_TERM}`, byGrammar: true, byRegistered: false },
	{ label: 'a tag sequence with an unregistered subdivision', input: `🏴${tag('usca')}${TAG_TERM}`, byGrammar: true, byRegistered: false },
	{ label: 'a skin tone on a base with no registered toned form', input: '👪🏻', byGrammar: true, byRegistered: false },

	// Rejected by both. The lone components are the ones `\p{RGI_Emoji}` accepted.
	{ label: 'a lone skin-tone modifier', input: '🏽', byGrammar: false, byRegistered: false },
	{ label: 'a lone hair component', input: '🦰', byGrammar: false, byRegistered: false },
	{ label: 'a lone regional indicator', input: '🇦', byGrammar: false, byRegistered: false },
	{ label: 'a lone ZWJ', input: ZWJ, byGrammar: false, byRegistered: false },
	{ label: 'a lone VS16', input: VS16, byGrammar: false, byRegistered: false },
	{ label: 'a lone combining keycap', input: COMBINING_KEYCAP, byGrammar: false, byRegistered: false },
	{ label: 'a lone tag character', input: tag('g'), byGrammar: false, byRegistered: false },
	{ label: 'a lone tag terminator', input: TAG_TERM, byGrammar: false, byRegistered: false },
	{ label: 'a run of skin-tone modifiers', input: '🏽🏽', byGrammar: false, byRegistered: false },
	{ label: 'a skin-tone modifier before its base', input: '🏽👍', byGrammar: false, byRegistered: false },
	{ label: 'a skin-tone modifier after a complete sequence', input: '👍🏽🏽', byGrammar: false, byRegistered: false },
	{ label: 'a digit', input: '1', byGrammar: false, byRegistered: false },
	{ label: 'several digits', input: '123', byGrammar: false, byRegistered: false },
	{ label: 'a number sign', input: '#', byGrammar: false, byRegistered: false },
	{ label: 'an asterisk', input: '*', byGrammar: false, byRegistered: false },
	{ label: 'a heart without VS16', input: '❤', byGrammar: false, byRegistered: false },
	{ label: 'a smiling face without VS16', input: '☺', byGrammar: false, byRegistered: false },
	{ label: 'a copyright sign without VS16', input: '©', byGrammar: false, byRegistered: false },
	{ label: 'a modifier base with neither emoji presentation nor VS16', input: '☝', byGrammar: false, byRegistered: false },
	{ label: 'a combining keycap on a base that is not a keycap base', input: `⌚${VS16}${COMBINING_KEYCAP}`, byGrammar: false, byRegistered: false },
	{ label: 'a skin tone after a VS16-qualified base', input: `✊${VS16}🏻`, byGrammar: false, byRegistered: false },
	{ label: 'a letter', input: 'a', byGrammar: false, byRegistered: false },
	{ label: 'an emoji with a trailing letter', input: '😀a', byGrammar: false, byRegistered: false },
	{ label: 'an emoji with a leading letter', input: 'a😀', byGrammar: false, byRegistered: false },
	{ label: 'a space', input: ' ', byGrammar: false, byRegistered: false },
	{ label: 'the empty string', input: '', byGrammar: false, byRegistered: false },
	{ label: 'a single regional indicator after a flag', input: '🇹🇼🇦', byGrammar: false, byRegistered: false },
	{ label: 'a trailing ZWJ', input: `😀${ZWJ}`, byGrammar: false, byRegistered: false },
	{ label: 'a leading ZWJ', input: `${ZWJ}😀`, byGrammar: false, byRegistered: false },
	{ label: 'a doubled ZWJ', input: `😀${ZWJ}${ZWJ}😀`, byGrammar: false, byRegistered: false },
	{ label: 'a ZWJ followed by a regional indicator', input: `😀${ZWJ}🇦`, byGrammar: false, byRegistered: false },
	{ label: 'a ZWJ followed by a skin-tone modifier', input: `😀${ZWJ}🏽`, byGrammar: false, byRegistered: false },
	{ label: 'a tag sequence with no terminator', input: `🏴${tag('gbeng')}`, byGrammar: false, byRegistered: false },
	{ label: 'a tag terminator with no specifier', input: `🏴${TAG_TERM}`, byGrammar: false, byRegistered: false },
]

describe('isEmoji step plugin', () => {
	it.each(corpus.filter(entry => entry.byGrammar))('accepts $label by default', ({ input }) => {
		expect(defaultSchema.execute(input))
			.toEqual({ value: input })
	})

	it.each(corpus.filter(entry => !entry.byGrammar))('rejects $label by default', ({ input }) => {
		expect(defaultSchema.execute(input))
			.toMatchObject({ issues: [{ code: 'isEmoji:expected_emoji' }] })
	})

	it.each(corpus.filter(entry => entry.byRegistered))('accepts $label with registered: true', ({ input }) => {
		expect(registeredSchema.execute(input))
			.toEqual({ value: input })
	})

	it.each(corpus.filter(entry => !entry.byRegistered))('rejects $label with registered: true', ({ input }) => {
		expect(registeredSchema.execute(input))
			.toMatchObject({ issues: [{ code: 'isEmoji:expected_emoji' }] })
	})

	it('accepts strictly more than the registered set', () => {
		// The containment the two paths are meant to have. A row claiming
		// `byRegistered` without `byGrammar` would be a grammar regression that
		// both suites above would happily report as passing.
		expect(corpus.filter(entry => entry.byRegistered && !entry.byGrammar))
			.toEqual([])
		expect(corpus.filter(entry => entry.byGrammar && !entry.byRegistered).length)
			.toBeGreaterThan(0)
	})

	it('stays linear on a long valid prefix that fails at its last character', () => {
		// `+` over an alternation whose members can partition a string more than
		// one way is the shape that backtracks catastrophically. Doubling the input
		// must roughly double the work, not square it.
		const family = `👨${ZWJ}👩${ZWJ}👧${ZWJ}👦`
		const time = (count: number) => {
			const input = `${family.repeat(count)}a`
			const start = performance.now()
			for (let index = 0; index < 200; index++) {
				expect(defaultSchema.execute(input))
					.toMatchObject({ issues: [{ code: 'isEmoji:expected_emoji' }] })
			}
			return performance.now() - start
		}
		time(16)
		const short = time(16)
		const long = time(256)
		// 16× the input for well under 16× the cost squared; the measured ratio is
		// about 16, and a quadratic blow-up would be 256.
		expect(long / short)
			.toBeLessThan(64)
	})

	it('reports the owned issue shape', () => {
		expect(defaultSchema.execute('a'))
			.toEqual({
				issues: [{
					code: 'isEmoji:expected_emoji',
					category: 'validation',
					message: 'Expected an emoji.',
					path: [],
					payload: { value: 'a', registered: false },
				}],
			})
	})

	it('records the requested accepted set in the payload', () => {
		expect(registeredSchema.execute('a'))
			.toEqual({
				issues: [{
					code: 'isEmoji:expected_emoji',
					category: 'validation',
					message: 'Expected an emoji.',
					path: [],
					payload: { value: 'a', registered: true },
				}],
			})
	})

	it('supports custom messages on both accepted sets', () => {
		expect(v.string()
			.isEmoji({ message: 'Custom' })
			.execute('a'))
			.toMatchObject({ issues: [{ message: 'Custom' }] })
		expect(v.string()
			.isEmoji({ registered: true, message: 'Custom' })
			.execute('a'))
			.toMatchObject({ issues: [{ message: 'Custom' }] })
	})

	it('treats registered: false as the default accepted set', () => {
		expect(v.string()
			.isEmoji({ registered: false })
			.execute(`👍${ZWJ}👍`))
			.toEqual({ value: `👍${ZWJ}👍` })
	})

	it('imports and validates by default where the regular-expression v flag is missing', async () => {
		// The import hazard #128 measured: the previous implementation held a `v`
		// flag in a regular-expression *literal*, which is a parse-time
		// SyntaxError on an engine without it — so the whole module failed to load
		// and took every other step with it. The `v` flag now lives behind
		// `new RegExp`, so the module loads and only `{ registered: true }` is
		// affected. Stubbing the constructor is how a supported runtime, where the
		// flag always exists, can execute that path at all.
		const NativeRegExp = globalThis.RegExp
		function withoutVFlag(source: string, flags?: string): RegExp {
			if (flags?.includes('v') === true)
				throw new SyntaxError('Invalid regular expression flags')
			return new NativeRegExp(source, flags)
		}
		// Keeps `instanceof RegExp` true for anything built while the stub is in
		// place; the stub is called with `new`, and a constructor returning an
		// object hands back that object, so what callers receive is a real RegExp.
		withoutVFlag.prototype = NativeRegExp.prototype

		vi.resetModules()
		vi.stubGlobal('RegExp', withoutVFlag)
		try {
			const fresh = await import('../..')
			const instance = fresh.createValchecker({ steps: [fresh.string, fresh.isEmoji] })

			expect(instance.string()
				.isEmoji()
				.execute('😀'))
				.toEqual({ value: '😀' })
			expect(instance.string()
				.isEmoji()
				.execute('a'))
				.toMatchObject({ issues: [{ code: 'isEmoji:expected_emoji' }] })

			expect(instance.string()
				.isEmoji({ registered: true })
				.execute('😀'))
				.toEqual({
					issues: [{
						code: 'isEmoji:unsupported_registered_set',
						category: 'operation',
						message: 'Expected a registered emoji, but this runtime cannot express the registered set: the regular-expression `v` flag is unavailable.',
						path: [],
						payload: { value: '😀', error: expect.any(SyntaxError) },
					}],
				})
			expect(instance.string()
				.isEmoji({ registered: true, message: 'Custom' })
				.execute('😀'))
				.toMatchObject({ issues: [{ code: 'isEmoji:unsupported_registered_set', message: 'Custom' }] })
		}
		finally {
			vi.unstubAllGlobals()
			vi.resetModules()
		}
	})
})
