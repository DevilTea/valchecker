import { bench, describe } from 'vitest'
import { createValchecker, isEmoji, string } from '../..'

const v = createValchecker({ steps: [string, isEmoji] })

const schema = v.string()
	.isEmoji()
const registeredSchema = v.string()
	.isEmoji({ registered: true })

// The two accepted sets are measured on the same inputs, because they are two
// semantics rather than two implementations of one: the grammar accepts every
// structurally valid sequence and `{ registered: true }` only the RGI set. The
// inputs are the ones #128's cost table used, so a run here is comparable with it.
const inputs = {
	bare: '😀',
	toned: '👍🏽',
	family: '👨\u{200D}👩\u{200D}👧\u{200D}👦',
	flag: '🇹🇼',
	invalid: '👍a',
	nonEmoji: '123',
	// A long valid prefix that fails at its last character: the shape an anchored
	// alternation backtracks on.
	longFailure: `${'👨\u{200D}👩\u{200D}👧\u{200D}👦'.repeat(64)}a`,
}

describe('isEmoji benchmarks', () => {
	for (const [label, input] of Object.entries(inputs)) {
		bench(`${label} input`, () => {
			schema.execute(input)
		})
	}

	for (const [label, input] of Object.entries(inputs)) {
		bench(`${label} input, registered set`, () => {
			registeredSchema.execute(input)
		})
	}
})
