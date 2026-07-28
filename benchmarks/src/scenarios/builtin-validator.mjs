// Two families that measure the same validation an older scenario expresses by
// hand, spelled instead with the built-in validator a user would reach for now:
// `flat-object-builtin/*` replaces a `check()` closure with `isMatching`, and
// `membership/*` replaces a `union` of literals with `isOneOf`.
import { flatObject } from '../fixtures.mjs'
import { warm } from './define.mjs'

const membershipInputs = {
	valid: 'green',
	invalid: 'yellow',
}

// `check` is here because the adapter builds this shape by spreading
// `createFields()` and then replacing the email field, so a `check()` email schema
// is constructed and immediately discarded. It cannot move either number these
// scenarios report — the discarded schema executes nothing, and construction happens
// once during setup — but `steps` declares what `build()` *calls*, not what the timed
// operation reaches, and `step-audit.mjs` compares the declaration against the calls
// it observes. Declaring the effect instead of the call is how the two mechanisms that
// read this field, step coverage and impact selection, would go on trusting a claim
// nothing checks.
const builtinFlatObjectSteps = ['object', 'string', 'number', 'isInteger', 'isAtLeast', 'boolean', 'literal', 'isMatching', 'check']
const membershipSteps = ['string', 'isOneOf']

export const builtinValidatorScenarios = [
	// The pre-existing flat-object scenarios model the email field with a
	// `check()` closure because no format validator existed when they were
	// written, which understates today's idiomatic Valchecker. This variant keeps
	// the same validation semantics and every competitor schema unchanged, and
	// only spells the Valchecker side the way a user would write it now.
	warm('flat-object-builtin/valid', 'standard', 'builtinFlatObject', flatObject.valid, { success: true }, { comparisonScope: 'compatible-subset', steps: builtinFlatObjectSteps }),
	warm('flat-object-builtin/invalid-last', 'full', 'builtinFlatObject', flatObject.invalidLast, { success: false }, { comparisonScope: 'compatible-subset', steps: builtinFlatObjectSteps }),

	// Valchecker validates the string and then membership; the competitors
	// dispatch a single enum/picklist check. The benchmark deliberately measures
	// the `string().isOneOf()` chain, which is both idiomatic and faster here
	// than the single-step `union([...])` shorthand.
	warm('membership/valid', 'standard', 'membership', membershipInputs.valid, { success: true, output: membershipInputs.valid }, { comparisonScope: 'compatible-subset', steps: membershipSteps }),
	warm('membership/invalid', 'full', 'membership', membershipInputs.invalid, { success: false }, { comparisonScope: 'compatible-subset', steps: membershipSteps }),
]
