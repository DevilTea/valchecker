// `variant/*` and `union-large/*`: one set of twenty tagged object branches,
// dispatched two ways. This is the comparison the suite was missing entirely —
// every participant ships a tagged-union schema, and the only family measuring
// alternatives before this was the five-branch `union/*`.
//
// Two design decisions, both about making the dispatch strategy the thing that
// varies:
//
// 1. **Twenty branches, one payload shape.** Twenty is a realistic tagged event
//    or message union — the size at which a real API's `type` field arrives — and
//    it is large enough for a difference in dispatch to exceed the 5% the harness
//    needs to call an ordering reproducible: a linear scan reaching the last
//    branch does twenty discriminator comparisons where a lookup does one. Five,
//    the existing `union` key, cannot separate the two strategies. Every branch
//    then carries the identical `{ type, id, size, enabled }` payload, so an early
//    hit and a late hit differ in dispatch and in nothing else. The varied-payload
//    framing stays with `union/*`, whose ids and fixtures are unchanged.
// 2. **One branch set for both keys.** The adapters build `variant` and
//    `unionLarge` from the same `taggedUnionTags` list in the same order, so
//    `union-large/last` and `variant/late` are the same twenty branches reached
//    two ways, and their ratio is the cost of trying branches in order rather
//    than looking the tag up.
//
// What the four libraries actually do, read from their sources rather than
// assumed: Valchecker's `variant` builds a Map of executors and runs exactly one;
// Zod 3's `discriminatedUnion` keeps an `optionsMap` and Zod 4's a cached
// discriminator Map, so both are lookups too; Valibot's `variant` is a linear
// scan that runs each option's discriminator schema until one matches. So the
// family measures three lookups against one linear scan on the tagged side, and
// four linear scans on the `union` side.
//
// Scope. `variant/*` is `compatible-subset`, for two differences established by
// executing the fixtures:
//
// - Valchecker requires the discriminator to be an **own** property, while both
//   Zods read `input[discriminator]` and Valibot tests `key in input`, so an
//   inherited tag is accepted there and rejected here. Every fixture below is a
//   plain object with its own `type`.
// - Valchecker accepts any string, number, or symbol property key as a variant
//   key, while Zod needs each branch to expose a literal value at the
//   discriminator and Valibot needs the key in each option's entries. String tags
//   are the intersection, so the fixtures use them.
//
// Both failure fixtures were executed through all four adapters before being
// kept. A non-object input was checked too and needs no gate — all four reject it
// before any discriminator work (`variant:expected_object` here, an
// `invalid_type` in Zod, a type issue in Valibot) — but it measures a container
// check rather than dispatch, so it gets no scenario of its own.
import { taggedUnionTags } from '../fixtures.mjs'
import { warm } from './define.mjs'

function branch(index, overrides) {
	return Object.freeze({
		type: taggedUnionTags[index],
		id: `event-${index}`,
		size: index,
		enabled: index % 2 === 0,
		...overrides,
	})
}

const inputs = {
	first: branch(0),
	middle: branch(9),
	last: branch(19),
	// A tag no branch declares. The variant reports one
	// `variant:invalid_discriminator` from the lookup; the plain union reports one
	// `literal:expected_literal` per branch, which is the diagnostic half of the
	// same difference.
	unknownTag: branch(1, { type: 'unlisted' }),
	// The tag selects the last branch and `size` then fails inside it, so the
	// failure is the selected branch's and not the dispatch's.
	invalidBranch: branch(19, { size: 'not-a-number' }),
}

const variantSteps = ['variant', 'object', 'literal', 'string', 'number', 'boolean']
const unionLargeSteps = ['union', 'object', 'literal', 'string', 'number', 'boolean']

const subset = 'compatible-subset'

export const taggedUnionScenarios = [
	// `early` and `late` are the pair that shows dispatch: a lookup makes them cost
	// the same, a linear scan does not.
	warm('variant/early', 'standard', 'variant', inputs.first, { success: true, output: inputs.first }, { comparisonScope: subset, steps: variantSteps }),
	warm('variant/late', 'standard', 'variant', inputs.last, { success: true, output: inputs.last }, { comparisonScope: subset, steps: variantSteps }),
	warm('variant/unknown-tag', 'full', 'variant', inputs.unknownTag, { success: false }, { comparisonScope: subset, steps: variantSteps }),
	warm('variant/branch-invalid', 'full', 'variant', inputs.invalidBranch, { success: false }, { comparisonScope: subset, steps: variantSteps }),

	// The same branches without a discriminator. Branch order is normative for
	// Valchecker, so `last` is the worst case for every library here.
	warm('union-large/first', 'standard', 'unionLarge', inputs.first, { success: true, output: inputs.first }, { steps: unionLargeSteps }),
	warm('union-large/middle', 'full', 'unionLarge', inputs.middle, { success: true, output: inputs.middle }, { steps: unionLargeSteps }),
	warm('union-large/last', 'standard', 'unionLarge', inputs.last, { success: true, output: inputs.last }, { steps: unionLargeSteps }),
	warm('union-large/all-fail', 'full', 'unionLarge', inputs.unknownTag, { success: false }, { steps: unionLargeSteps }),
]
