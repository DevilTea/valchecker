import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type SelfIssue
		= | ExecutionIssue<'isEmoji:expected_emoji', { value: string, registered: boolean }>
			| ExecutionIssue<'isEmoji:unsupported_registered_set', { value: string, error: unknown }, 'operation'>

	export interface Options extends StepOptions<SelfIssue> {
		/**
		 * Accept only the sequences in Unicode's RGI set instead of every
		 * structurally valid emoji sequence. Needs a runtime with the
		 * regular-expression `v` flag.
		 */
		readonly registered?: boolean | undefined
	}
}

// The default accepted set is the UTS #51 emoji sequence grammar, written from
// the specification's own definitions rather than adapted from another library's
// pattern. Each fragment names the definition it comes from.
//
// It replaced `\p{RGI_Emoji}`, which costs 5,275 ns on a bare `👍` against this
// grammar's 47 ns (2026-07-28, median of five runs of 100,000 after a 50,000
// warmup): the property-of-strings matcher enumerates every longer registered
// sequence that a bare base emoji is a prefix of. `{ registered: true }` still
// buys the registered set at that price.
//
// Every invisible character is written as an escape. A literal ZWJ, VS16, or tag
// character in this source would be unreadable and silently editable.
const VS16 = String.raw`\u{FE0F}`
const ZWJ = String.raw`\u{200D}`
const COMBINING_KEYCAP = String.raw`\u{20E3}`
const TAG_SPEC = String.raw`[\u{E0020}-\u{E007E}]`
const TAG_TERM = String.raw`\u{E007F}`
const EMOJI = String.raw`\p{Emoji}`
const EMOJI_PRESENTATION = String.raw`\p{Emoji_Presentation}`
const EMOJI_COMPONENT = String.raw`\p{Emoji_Component}`
const EMOJI_MODIFIER = String.raw`\p{Emoji_Modifier}`
const EMOJI_MODIFIER_BASE = String.raw`\p{Emoji_Modifier_Base}`
const REGIONAL_INDICATOR = String.raw`\p{RI}`

/** ED-27 emoji_keycap_sequence. */
const keycapSequence = `[#*0-9]${VS16}${COMBINING_KEYCAP}`
/** ED-14 emoji_flag_sequence: exactly two regional indicators. */
const flagSequence = `${REGIONAL_INDICATOR}{2}`
/** ED-13 emoji_modifier_sequence: a base and a skin tone, with no VS16 between them. */
const modifierSequence = `${EMOJI_MODIFIER_BASE}${EMOJI_MODIFIER}`
/** ED-9a emoji_presentation_sequence: any emoji character made emoji-presenting by VS16. */
const presentationSequence = `${EMOJI}${VS16}`

// ED-23 emoji_zwj_element. A bare character must already present as emoji, so a
// text-presentation character needs its VS16. A regional indicator and a
// skin-tone modifier each have one defined position of their own — a flag pair
// and a modifier sequence — so neither is an element here.
const zwjElement = `(?:${modifierSequence}|${presentationSequence}|(?![${REGIONAL_INDICATOR}${EMOJI_MODIFIER}])${EMOJI_PRESENTATION})`
// The same, minus every bare `Emoji_Component`. A component is only meaningful
// inside a longer sequence, so it may neither open one nor stand as one: this is
// what rejects a lone `🏽`, a lone `🦰`, and a lone `🇦`.
const leadElement = `(?:${modifierSequence}|${presentationSequence}|(?!${EMOJI_COMPONENT})${EMOJI_PRESENTATION})`

// ED-19 emoji_tag_sequence and ED-24 emoji_zwj_sequence share their first
// element, so they are one alternative behind a common prefix. Factoring them
// this way is also what keeps the failure path linear: a partition that does not
// work out leaves the outer `+` looking at a ZWJ, a tag character, or a bare
// component, which no alternative can start from, so it dies without exploring
// further. Measured on a long valid prefix failing at its last character, the
// grammar scales linearly — 0.0018 ms at 8 ZWJ families to 0.0578 ms at 256 —
// where an anchored `^(?:\p{RGI_Emoji})+$` reaches 1.47 ms at 256.
const emojiSequence = `(?:${keycapSequence}|${flagSequence}|${leadElement}(?:${TAG_SPEC}+${TAG_TERM}|(?:${ZWJ}${zwjElement})*))`
const emojiPattern = new RegExp(`^${emojiSequence}+$`, 'u')

// `\p{RGI_Emoji}` needs the `v` flag, and a literal asking for a flag the engine
// does not have is a parse-time SyntaxError — which takes this whole module down
// and every step exported beside it. Through the constructor the failure is
// catchable and stays confined to `{ registered: true }`.
//
// The five skin-tone modifiers and the four hair components are
// `Emoji_Component` members of `\p{RGI_Emoji}`, which is why the difference is
// taken: without it a lone `🏽` counts as a registered emoji.
//
// The unanchored `replace` form is deliberate. `^[…]+$` over the same class is
// 20× slower on a long valid prefix that fails at its last character (1.47 ms
// against 0.055 ms at 256 ZWJ families) and no faster anywhere else, and the two
// agree on all 138,466 inputs of the differential corpus.
const registeredSource = String.raw`[\p{RGI_Emoji}--\p{Emoji_Component}]`
const registeredSupport: { pattern: RegExp, error?: undefined } | { pattern?: undefined, error: unknown } = (() => {
	try {
		return { pattern: new RegExp(registeredSource, 'gv') }
	}
	catch (error) {
		return { error }
	}
})()

type Meta = DefineStepMethodMeta<{
	Name: 'isEmoji'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string }>
	SelfIssue: Internal.SelfIssue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the string is one or more emoji and nothing else. The empty
	 * string is rejected.
	 *
	 * By default the accepted set is the Unicode UTS #51 emoji sequence
	 * grammar: an emoji-presentation character, an emoji character followed by
	 * VS16, a keycap sequence, a skin-tone modifier sequence, a regional
	 * indicator pair, a tag sequence, and a ZWJ chain of those. A bare
	 * `Emoji_Component` is not an emoji by itself, so a lone skin-tone modifier
	 * (`🏽`), a lone hair component (`🦰`), a lone regional indicator (`🇦`), a
	 * lone ZWJ, a lone VS16, a lone tag character, and a lone combining keycap
	 * are all rejected — as are `1`, `123`, `#`, `*`, and a text-presentation
	 * character without its VS16 such as `❤`, `☺`, or `©`.
	 *
	 * `{ registered: true }` narrows the accepted set to Unicode's RGI set
	 * (`\p{RGI_Emoji}` minus bare components), the sequences every vendor is
	 * expected to render. It costs roughly 110× more and needs the
	 * regular-expression `v` flag; where the runtime has no `v` flag it fails
	 * with `'isEmoji:unsupported_registered_set'` rather than quietly falling
	 * back to a different accepted set.
	 *
	 * The default therefore accepts structurally valid sequences that are not
	 * registered. Named examples, written with code points because the joiners
	 * are invisible:
	 *
	 * - `👍‍👍` (U+1F44D ZWJ U+1F44D) and `😀‍🚀` (U+1F600 ZWJ U+1F680) —
	 *   well-formed ZWJ chains of registered emoji that are not themselves
	 *   registered;
	 * - `1️` (U+0031 U+FE0F) — a digit with VS16 and no combining keycap, so an
	 *   emoji presentation sequence but not a keycap sequence;
	 * - `🇦🇦` (U+1F1E6 U+1F1E6) — a regional indicator pair that is not a
	 *   country;
	 * - `⌚️` (U+231A U+FE0F) — a redundant VS16 on a character that already
	 *   presents as emoji, which the registered set does not list and real text
	 *   contains anyway.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isEmoji, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isEmoji] })
	 * const result = v.string().isEmoji().execute('😀')
	 * const registered = v.string().isEmoji({ registered: true }).execute('😀')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isEmoji:expected_emoji'`: The string is not an emoji.
	 * - `'isEmoji:unsupported_registered_set'`: `registered: true` was asked for
	 *   on a runtime without the regular-expression `v` flag, so the RGI set
	 *   cannot be expressed. Reachable only with that option.
	 */
	isEmoji: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? (options?: Internal.Options) => Next<
					{ issue: Meta['SelfIssue'] },
					this['CurrentValchecker']
				>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isEmoji = implStepPlugin<PluginDef>({
	isEmoji: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		const registered = options?.registered === true
		const expectedEmoji = (value: string) => failure(
			createIssue({
				code: 'isEmoji:expected_emoji',
				payload: { value, registered },
				customMessage: options?.message,
				defaultMessage: 'Expected an emoji.',
			}),
		)

		if (!registered) {
			addSuccessStep(value => emojiPattern.test(value)
				? success(value)
				: expectedEmoji(value))
			return
		}

		// The probe settled at module load, so which of the two steps to install is
		// decided here rather than re-tested on every execution.
		const { pattern, error } = registeredSupport
		if (pattern === undefined) {
			addSuccessStep(value => failure(
				createIssue({
					code: 'isEmoji:unsupported_registered_set',
					category: 'operation',
					payload: { value, error },
					customMessage: options?.message,
					defaultMessage: 'Expected a registered emoji, but this runtime cannot express the registered set: the regular-expression `v` flag is unavailable.',
				}),
			))
			return
		}

		addSuccessStep(value => value !== '' && value.replace(pattern, '') === ''
			? success(value)
			: expectedEmoji(value))
	},
}, 'sync')
