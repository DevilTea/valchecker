// `nullish/*`: the three narrowing validators, `isDefined()`, `isNonNull()`, and
// `isNonNullish()`, each on `v.unknown()` because they require an output that can
// be `undefined` or `null` in the first place. The suite covered the other
// direction only — the `[v.string()]` optional-field shorthand inside
// `optional-heavy/*`, which is `object`'s own optional handling and not a `union`
// branch, and so is declared there without `union`.
//
// The opponents are `optional`/`nullable`/`nullish` inverted, not those wrappers
// themselves: `optional()` *accepts* `undefined` where `isDefined()` *rejects* it,
// so measuring one against the other would compare opposite decisions. What
// exists, checked in the pinned builds rather than assumed:
//
// - `undefined` rejection — `z.unknown().nonoptional()` in Zod 4 and
//   `v.nonOptional(v.unknown())` in Valibot. Zod 3 has no `nonoptional`, and a
//   `.refine(value => value !== undefined)` closure would be a stand-in for the
//   built-in the other three ship, so Zod 3 is gated out;
// - `null` rejection and nullish rejection — `v.nonNullable()` and
//   `v.nonNullish()` in Valibot only. Neither pin of Zod has a `nonnullable` or a
//   non-nullish schema at all, on the type or as a top-level function, so both
//   scenarios are Valchecker against Valibot.
//
// Scope is `equivalent`: every participant accepts exactly the same values,
// rejects exactly the same values, and preserves the input — including the two
// asymmetric cases that make these three steps distinct, `isDefined()` passing
// `null` through and `isNonNull()` passing `undefined` through, both verified on
// every participating adapter.
import { warm } from './define.mjs'

const inputs = {
	// A value that is neither `null` nor `undefined`, so it passes all three.
	present: 'value',
	missing: undefined,
	empty: null,
}

const definedSteps = ['unknown', 'isDefined']
const nonNullSteps = ['unknown', 'isNonNull']
const nonNullishSteps = ['unknown', 'isNonNullish']

const undefinedRejection = ['undefined rejection']
const nullRejection = ['null rejection']
const nullishRejection = ['nullish rejection']

export const nullishScenarios = [
	warm('nullish/defined-valid', 'standard', 'narrowDefined', inputs.present, { success: true, output: inputs.present }, { requiredFeatures: undefinedRejection, steps: definedSteps }),
	warm('nullish/defined-invalid', 'full', 'narrowDefined', inputs.missing, { success: false }, { requiredFeatures: undefinedRejection, steps: definedSteps }),

	warm('nullish/non-null-valid', 'standard', 'narrowNonNull', inputs.present, { success: true, output: inputs.present }, { requiredFeatures: nullRejection, steps: nonNullSteps }),
	warm('nullish/non-null-invalid', 'full', 'narrowNonNull', inputs.empty, { success: false }, { requiredFeatures: nullRejection, steps: nonNullSteps }),

	warm('nullish/non-nullish-valid', 'standard', 'narrowNonNullish', inputs.present, { success: true, output: inputs.present }, { requiredFeatures: nullishRejection, steps: nonNullishSteps }),
	warm('nullish/non-nullish-invalid', 'full', 'narrowNonNullish', inputs.empty, { success: false }, { requiredFeatures: nullishRejection, steps: nonNullishSteps }),
]
