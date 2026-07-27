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

// The adapter builds this shape by spreading `createFields()` and replacing the
// email field, so the `check()` email schema is constructed and immediately
// discarded. It is not part of the schema these scenarios execute — nor of the
// schema construction they measure, which happens once during setup — so `check`
// is deliberately absent.
const builtinFlatObjectSteps = ['object', 'string', 'number', 'isInteger', 'isAtLeast', 'boolean', 'literal', 'isMatching']
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
