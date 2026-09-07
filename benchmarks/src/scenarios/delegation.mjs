// `delegation/*`: one already-built schema composed into another. Valchecker
// spells it `unknown().use(inner)`, both Zod pins as `.pipe(inner)`, and Valibot
// as a nested schema inside `pipe()`; all three were executed over these two
// fixtures before the family was added, and all three transform the valid input
// and report the inner schema's issue for the invalid one. The delegated schema
// is the `primitiveBuiltin` chain every adapter already builds, so a row here
// pairs with `primitive-builtin/*` over the identical fixture and the difference
// is the delegation layer alone.
import { primitive } from '../fixtures.mjs'
import { warm } from './define.mjs'

// `v.unknown().use(v.string().isLengthAtLeast(3).isLengthAtMost(32).isMatching(...))`
const delegationComparisonNote = 'Valchecker composes an already-built inner schema with `unknown().use(inner)`, Zod uses `.pipe(inner)`, and Valibot nests a schema inside `pipe()`; executable conformance proves the same delegated success/output and inner failure semantics.'

const delegationSteps = ['unknown', 'use', 'string', 'isLengthAtLeast', 'isLengthAtMost', 'isMatching']

export const delegationScenarios = [
	warm('delegation/valid', 'standard', 'delegate', primitive.valid, { success: true, output: primitive.valid }, { comparisonNote: delegationComparisonNote, steps: delegationSteps }),
	// The pattern check inside the delegated schema is what fails, so this row is the
	// inner issue travelling back out through the delegation layer rather than a
	// rejection by the outer schema.
	warm('delegation/invalid-late', 'standard', 'delegate', primitive.invalidLate, { success: false }, { comparisonNote: delegationComparisonNote, steps: delegationSteps }),
]
