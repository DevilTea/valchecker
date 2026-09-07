// `primitive-builtin/*`: observably the same validation `primitive/*` measures, with the
// Valchecker side's `check()` closure replaced by the `isMatching` pattern
// validator that shipped after the original scenario was written. Zod and Valibot
// were always spelled with a built-in pattern action (`.regex(...)`, `v.regex()`),
// so `primitive/*` compared a user closure against a built-in on one side only.
//
// This follows `flat-object-builtin/*`: a new build key and new ids rather than an
// edit, so `primitive/*` stays comparable with the baseline runs the open
// performance issues cite, and the closure cost and the built-in cost are both
// visible. The pair to read together is `primitive/valid` against
// `primitive-builtin/valid`.
import { primitive } from '../fixtures.mjs'
import { warm } from './define.mjs'

// `v.string().isLengthAtLeast(3).isLengthAtMost(32).isMatching(/^[a-z0-9-]+$/)`
const primitiveBuiltinSteps = ['string', 'isLengthAtLeast', 'isLengthAtMost', 'isMatching']

export const primitiveBuiltinScenarios = [
	warm('primitive-builtin/valid', 'standard', 'primitiveBuiltin', primitive.valid, { success: true, output: primitive.valid }, { comparisonNote: 'Valchecker uses the built-in `isMatching` step while Zod and Valibot use their built-in regex actions; the executable conformance contract proves the same accepted/rejected values and preserved output despite different internal implementations.', steps: primitiveBuiltinSteps }),
	// `primitive.invalidLate` reaches the pattern before failing, which is the step
	// the two spellings differ in. `primitive/invalid-type` has no counterpart here:
	// the chain aborts at the string check without reaching either spelling, so it
	// would measure the same work twice.
	warm('primitive-builtin/invalid-late', 'full', 'primitiveBuiltin', primitive.invalidLate, { success: false }, { comparisonNote: 'Valchecker uses the built-in `isMatching` step while Zod and Valibot use their built-in regex actions; the executable conformance contract proves the same accepted/rejected values and preserved output despite different internal implementations.', steps: primitiveBuiltinSteps }),
]
