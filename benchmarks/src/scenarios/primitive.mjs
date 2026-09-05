// `primitive/*`: a single string pipeline with two length bounds and a closure
// predicate, exercised on a value that passes, one that fails the type check
// first, and one that reaches the closure before failing.
import { primitive } from '../fixtures.mjs'
import { warm } from './define.mjs'

// `v.string().isLengthAtLeast(3).isLengthAtMost(32).check(...)`
const primitiveComparisonNote = 'Valchecker expresses the final pattern predicate with a user `check()` closure while Zod and Valibot use built-in regex actions; equivalence is established by the executable observable contract, not by identical internal step shape.'

const primitiveSteps = ['string', 'isLengthAtLeast', 'isLengthAtMost', 'check']

export const primitiveScenarios = [
	warm('primitive/valid', 'smoke', 'primitive', primitive.valid, { success: true }, { comparisonNote: primitiveComparisonNote, steps: primitiveSteps }),
	warm('primitive/invalid-type', 'standard', 'primitive', primitive.invalidEarly, { success: false }, { comparisonNote: primitiveComparisonNote, steps: primitiveSteps }),
	warm('primitive/invalid-late', 'standard', 'primitive', primitive.invalidLate, { success: false }, { comparisonNote: primitiveComparisonNote, steps: primitiveSteps }),
]
