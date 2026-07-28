<!-- step-doc
category: formats
section: parsed
summary: the UTS #51 emoji sequence grammar, or Unicode's RGI set on request
-->

### `isEmoji(options?)`

Checks that the string is one or more emoji and nothing else. The empty string is rejected.

```ts
v.string()
	.isEmoji()
	.execute('🎉🎊')
// { value: '🎉🎊' }

v.string()
	.isEmoji({ registered: true })
	.execute('😀')
// { value: '😀' }
```

The default accepted set is the [UTS #51](https://www.unicode.org/reports/tr51/) emoji sequence
grammar, built from Unicode property escapes so it tracks the engine's Unicode version rather than a
release date. It accepts an emoji-presentation character, an emoji character followed by VS16, a
keycap sequence, a skin-tone modifier sequence, a regional indicator pair, a tag sequence, and a ZWJ
chain of those — one after another, in any number.

A bare `Emoji_Component` is not an emoji by itself, so a lone skin-tone modifier (`🏽`), a lone hair
component (`🦰`), a lone regional indicator (`🇦`), a lone ZWJ, a lone VS16, a lone tag character, and
a lone combining keycap are all rejected. So are `1`, `123`, `#`, `*`, and a text-presentation
character without its VS16, such as `❤`, `☺`, or `©`.

Adding VS16 does not promote a component to a whole emoji either. Forty-seven `Emoji_Component`
characters are also `\p{Emoji}`, so all forty-seven match the UTS #51 production for an emoji
presentation sequence — but ED-9a admits only the sequences listed in
`emoji-variation-sequences.txt`, and the keycap bases `#`, `*`, and `0`–`9` are the only
components in that file. So `1️` (U+0031 U+FE0F) is accepted while `🏽️` (U+1F3FD U+FE0F), `🇦️`
(U+1F1E6 U+FE0F), and `🦰️` (U+1F9B0 U+FE0F) are rejected, as are the composites those would
otherwise unlock, such as `🏽️` opening a ZWJ chain or standing as a tag base.

`isEmoji({ registered: true })` narrows the accepted set to Unicode's RGI set — `\p{RGI_Emoji}`
minus bare components — which is the sequences every vendor is expected to render. What that costs
depends on the input, because a property-of-strings match explores every longer registered sequence
its input is a prefix of, and a fully specified sequence matches one alternative and stops:

| Input | Default | `{ registered: true }` | Ratio |
| --- | ---: | ---: | ---: |
| `😀` | 47 ns | 5,293 ns | 113× |
| `👍` | 51 ns | 5,282 ns | 104× |
| `👍🏽` | 29 ns | 2,966 ns | 102× |
| `🇹🇼` | 18 ns | 781 ns | 43× |
| `👨‍👩‍👧‍👦` | 193 ns | 243 ns | 1.3× |
| `👍a` (invalid) | 87 ns | 5,791 ns | 67× |

Measured 2026-07-28 on Node.js 24.15.0, interleaved, median of nine runs of 200,000 after a 100,000
warmup, through the built package.

It also needs a runtime with the regular-expression `v` flag; where that flag is missing it fails
with `isEmoji:unsupported_registered_set` rather than silently accepting a different set.

The default therefore accepts structurally valid sequences that are not registered. Written with
code points, because the joiners are invisible:

| Input | Default | `{ registered: true }` | Why |
| --- | :-: | :-: | --- |
| `👍‍👍` (U+1F44D ZWJ U+1F44D) | accepted | rejected | a well-formed ZWJ chain that is not a registered emoji |
| `😀‍🚀` (U+1F600 ZWJ U+1F680) | accepted | rejected | the same |
| `1️` (U+0031 U+FE0F) | accepted | rejected | an emoji presentation sequence, but not the keycap sequence `1️⃣` |
| `🇦🇦` (U+1F1E6 U+1F1E6) | accepted | rejected | a regional indicator pair that is not a country |
| `⌚️` (U+231A U+FE0F) | accepted | rejected | a redundant VS16 on a character that already presents as emoji |
| `🏴󠁵󠁳󠁣󠁡󠁿` (U+1F3F4 + `usca` + U+E007F) | accepted | rejected | a well-formed tag sequence; only `gbeng`, `gbsct`, and `gbwls` are registered |
| `👪🏻` (U+1F46A U+1F3FB) | accepted | rejected | a modifier base and a skin tone whose combination is not registered |

**Issue codes:** `isEmoji:expected_emoji` (payload `{ value, registered }`),
`isEmoji:unsupported_registered_set` (category `operation`, payload `{ value, error }`, reachable
only with `registered: true`)
