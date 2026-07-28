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

// The default accepted set is the UTS #51 emoji sequence grammar, independently
// written and informed by prior art: the fragments below are derived from the
// specification's own productions, which is checkable against the ED numbers
// each one cites, but the outer shape — folding the ZWJ chain with `*`, hoisting
// the flag pair to a top-level branch, factoring the tag and ZWJ tails behind a
// shared lead element — is a rewriting for cost and is not in the productions.
// Other libraries arrive at a similar shape; nothing here was copied from one.
//
// It replaced `\p{RGI_Emoji}`, which costs 5,261 ns on a bare `👍` against this
// grammar's 51 ns (2026-07-28, interleaved, median of nine runs of 200,000 after
// a 100,000 warmup, through the built package): the property-of-strings matcher
// enumerates every longer registered sequence that a bare base emoji is a prefix
// of. `{ registered: true }` still buys the registered set at that price, so the
// gap is input-dependent — 104× on a bare `👍`, 43× on a flag, 1.3× on a
// four-person ZWJ family, which already matches one alternative and stops.
//
// Every invisible character is written as an escape. A literal ZWJ, VS16, or tag
// character in this source would be unreadable and silently editable.
const VS16 = String.raw`\u{FE0F}`
const ZWJ = String.raw`\u{200D}`
const COMBINING_KEYCAP = String.raw`\u{20E3}`
const TAG_SPEC = String.raw`[\u{E0020}-\u{E007E}]`
const TAG_TERM = String.raw`\u{E007F}`
const KEYCAP_BASE = String.raw`[#*0-9]`
const EMOJI = String.raw`\p{Emoji}`
const EMOJI_PRESENTATION = String.raw`\p{Emoji_Presentation}`
const EMOJI_COMPONENT = String.raw`\p{Emoji_Component}`
const EMOJI_MODIFIER = String.raw`\p{Emoji_Modifier}`
const EMOJI_MODIFIER_BASE = String.raw`\p{Emoji_Modifier_Base}`
const REGIONAL_INDICATOR = String.raw`\p{RI}`

/** ED-14c emoji_keycap_sequence. */
const keycapSequence = `${KEYCAP_BASE}${VS16}${COMBINING_KEYCAP}`
/** ED-14 emoji_flag_sequence: exactly two regional indicators. */
const flagSequence = `${REGIONAL_INDICATOR}{2}`
/** ED-13 emoji_modifier_sequence: a base and a skin tone, with no VS16 between them. */
const modifierSequence = `${EMOJI_MODIFIER_BASE}${EMOJI_MODIFIER}`
/**
 * ED-9a emoji_presentation_sequence: an emoji character made emoji-presenting by
 * VS16, narrowed by departure 2 below — the base may not be an `Emoji_Component`
 * unless it is a keycap base.
 */
const presentationSequence = `(?:${KEYCAP_BASE}|(?!${EMOJI_COMPONENT})${EMOJI})${VS16}`

// ED-15a emoji_zwj_element, narrowed by departures 1, 3, 4, and 5 to a modifier
// sequence, a presentation sequence, or a bare emoji-presentation character that
// is neither a regional indicator nor a skin-tone modifier. Each of those two has
// one defined position of its own — a flag pair and a modifier sequence — so
// neither is an element here.
const zwjElement = `(?:${modifierSequence}|${presentationSequence}|(?![${REGIONAL_INDICATOR}${EMOJI_MODIFIER}])${EMOJI_PRESENTATION})`
// The same, minus every bare `Emoji_Component` (departure 6). A component is only
// meaningful inside a longer sequence, so it may neither open one nor stand as
// one: this is what rejects a lone `🏽`, a lone `🦰`, and a lone `🇦`.
const leadElement = `(?:${modifierSequence}|${presentationSequence}|(?!${EMOJI_COMPONENT})${EMOJI_PRESENTATION})`

// ED-14a emoji_tag_sequence and ED-16 emoji_zwj_sequence share their first
// element, so they are one alternative behind a common prefix. ED-16's `+` folds
// to `*` because zero joiners leaves the lead element, which is already an
// ED-15 emoji_core_sequence and so an ED-17 emoji_sequence on its own.
//
// Factoring them this way is also what keeps the failure path linear: a partition
// that does not work out leaves the outer `+` looking at a ZWJ, a tag character,
// or a bare component, which no alternative can start from, so it dies without
// exploring further. Measured on a long valid prefix failing at its last
// character, the grammar scales linearly — 0.0019 ms at 8 ZWJ families to
// 0.0574 ms at 256, so 32× the input for 30× the time — where an anchored
// `^(?:\p{RGI_Emoji})+$` reaches 1.485 ms at 256.
const emojiSequence = `(?:${keycapSequence}|${flagSequence}|${leadElement}(?:${TAG_SPEC}+${TAG_TERM}|(?:${ZWJ}${zwjElement})*))`
const emojiPattern = new RegExp(`^${emojiSequence}+$`, 'u')

// Six deliberate departures from a literal reading of the productions above.
// Every one narrows the accepted set, and none of them rejects a member of the
// RGI set: enumerating that set out of the `v`-flag sub-properties gives 3,953
// members, and the only ones this grammar rejects are the nine lone components,
// which `{ registered: true }` rejects too.
//
// 1. ED-15's `emoji_character` alternative requires `Emoji_Presentation` here.
//    A literal reading accepts every `\p{Emoji}` character bare, which means
//    `1`, `#`, `*`, `❤`, `☺`, and `©` — the Zod defect #128 measured.
// 2. ED-9a's base excludes `Emoji_Component` except the twelve keycap bases.
//    ED-9a's constraint sentence limits valid presentation sequences to the ones
//    in `emoji-variation-sequences.txt`, and that file's 371 entries cannot be
//    written as a property escape — but its intersection with
//    `\p{Emoji_Component}` is exactly `#`, `*`, and `0`-`9`. Of the 47 component
//    characters that are also `\p{Emoji}`, those 12 are the only ones with a
//    registered presentation sequence, so the other 35 — 26 regional indicators,
//    5 skin tones, 4 hair components — are excluded. Without this, VS16 would
//    smuggle a lone component past departure 6: `🏽️` and `🇦️` would pass.
// 3. ED-15a's element omits `emoji_keycap_sequence`, so keycap-ZWJ-heart is
//    rejected.
// 4. ED-15a's element omits `emoji_flag_sequence`, and a flag pair is a top-level
//    branch that carries no ZWJ tail, so flag-ZWJ-flag and heart-ZWJ-flag are
//    both rejected.
// 5. ED-15a's element omits `emoji_tag_sequence`, and the tag tail and the ZWJ
//    tail are alternatives, so a tag sequence and a ZWJ chain cannot combine in
//    either order.
// 6. The lead element excludes every `Emoji_Component`, where the ZWJ element
//    excludes only regional indicators and skin-tone modifiers. The asymmetry is
//    load-bearing: excluding all components from the ZWJ element rejects `👨‍🦰`,
//    a registered sequence.
//
// 3, 4, and 5 are fidelity gaps rather than correctness bugs — nothing they
// reject renders as an emoji anywhere, and no RGI member is affected — so the
// pattern is left simpler and faster instead of complete.

// The five skin-tone modifiers and the four hair components are
// `Emoji_Component` members of `\p{RGI_Emoji}`, which is why the difference is
// taken: without it a lone `🏽` counts as a registered emoji.
//
// The unanchored `replace` form is deliberate. `^(?:[…])+$` over the same class
// is 28.6× slower on a long valid prefix that fails at its last character
// (1.485 ms against 0.052 ms at 256 ZWJ families) and no faster anywhere else,
// and the two agree on all 7,784,448 inputs of the differential corpus.
const registeredSource = String.raw`[\p{RGI_Emoji}--\p{Emoji_Component}]`
type RegisteredSupport = { pattern: RegExp, error?: undefined } | { pattern?: undefined, error: unknown }
let registeredSupport: RegisteredSupport | undefined
// `\p{RGI_Emoji}` needs the `v` flag, and a literal asking for a flag the engine
// does not have is a parse-time SyntaxError — which takes this whole module down
// and every step exported beside it. Through the constructor the failure is
// catchable and stays confined to `{ registered: true }`.
//
// The probe is a function rather than a module-level IIFE because Rollup's
// default `tryCatchDeoptimization: true` abandons analysis of a `try` block, so a
// module-scope probe survives tree-shaking: an entry importing only
// `createValchecker`, `string`, and `isEmail` carried 132 B of it — 8,983 B
// against 8,851 B — and ran one `new RegExp(…, 'gv')` at import. Behind a
// function it is reachable only from the step, so it goes when the step goes.
function resolveRegisteredSupport(): RegisteredSupport {
	if (registeredSupport === undefined) {
		try {
			registeredSupport = { pattern: new RegExp(registeredSource, 'gv') }
		}
		catch (error) {
			registeredSupport = { error }
		}
	}
	return registeredSupport
}

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
	 * character without its VS16 such as `❤`, `☺`, or `©`. Adding VS16 does not
	 * promote a component either: `🏽️` (U+1F3FD U+FE0F) and `🇦️` (U+1F1E6
	 * U+FE0F) are rejected, because the keycap bases `#`, `*`, and `0`-`9` are
	 * the only components Unicode gives an emoji presentation sequence.
	 *
	 * `{ registered: true }` narrows the accepted set to Unicode's RGI set
	 * (`\p{RGI_Emoji}` minus bare components), the sequences every vendor is
	 * expected to render. What it costs depends on the input, because a
	 * property-of-strings match explores every longer registered sequence its
	 * input is a prefix of: about 113× more on a bare `😀`, 43× on a flag, and
	 * 1.3× on a four-person ZWJ family. It also needs the regular-expression `v`
	 * flag; where the runtime has no `v` flag it fails with
	 * `'isEmoji:unsupported_registered_set'` rather than quietly falling back to
	 * a different accepted set.
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

		// The probe runs at most once, on the first `{ registered: true }` schema
		// built, so which of the two steps to install is decided here rather than
		// re-tested on every execution.
		const { pattern, error } = resolveRegisteredSupport()
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
