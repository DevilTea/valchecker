// `primitive/*`: a single string pipeline with two length bounds and a closure
// predicate, exercised on a value that passes, one that fails the type check
// first, and one that reaches the closure before failing.
import { primitive } from '../fixtures.mjs'
import { warm } from './define.mjs'

// `v.string().isLengthAtLeast(3).isLengthAtMost(32).check(...)`
const primitiveSteps = ['string', 'isLengthAtLeast', 'isLengthAtMost', 'check']

export const primitiveScenarios = [
	warm('primitive/valid', 'smoke', 'primitive', primitive.valid, { success: true }, { steps: primitiveSteps }),
	warm('primitive/invalid-type', 'standard', 'primitive', primitive.invalidEarly, { success: false }, { steps: primitiveSteps }),
	warm('primitive/invalid-late', 'standard', 'primitive', primitive.invalidLate, { success: false }, { steps: primitiveSteps }),
]
