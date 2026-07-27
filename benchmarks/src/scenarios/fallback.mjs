// `fallback/*`: recovery. `fallback(getValue)` here, `.catch()` in both Zods,
// `fallback()` in Valibot. All three take a getter callback and the adapters all
// pass one, so nothing in this family compares a user closure against a built-in —
// the callback is the API on every side. Zod's and Valibot's also accept a bare
// value, which would be cheaper; the callback form is used because it is the only
// form Valchecker's step has.
//
// Both paths are measured, because the common one in production is the path where
// nothing fails and the fallback is only attached:
//
// - `fallback/unused` — a valid input, so the fallback is never invoked. What it
//   costs to have one.
// - `fallback/recovers` — an input that fails the bound, so the failure is built
//   and then discarded in favour of the replacement value. The result is a
//   success, which is why the scenario is not in a failure group even though it
//   does failure work.
//
// Scope is `compatible-subset`, because the recoverable sets differ in both
// directions. Valchecker recovers `validation` and `operation` failures and leaves
// `internal` ones fatal — a three-category taxonomy neither competitor has. Zod's
// `.catch()` and Valibot's `fallback()` recover the issues their wrapped schema
// reports, but a callback that throws is not one of those: executed here,
// `z.number().refine(throws).catch(() => 0)` and the Valibot equivalent let the
// `Error` escape `safeParse`, while `v.number().check(throws).fallback(() => 0)`
// turns it into an operation issue and recovers it. So Valchecker's recoverable
// set is wider on thrown callbacks and narrower on internal issues, and neither
// end of that difference can be measured on the other side. Both fixtures below
// sit in the intersection where all four agree, verified on every adapter.
import { warm } from './define.mjs'

const inputs = {
	// Passes the bound, so the failure branch is never reached.
	valid: 42,
	// Fails `isAtLeast(0)` / `min(0)` / `minValue(0)`, which is the recovery under
	// test. A wrong-typed input would be recovered too, but by the leading type
	// check rather than by the constraint.
	belowBound: -5,
}

const fallbackSteps = ['number', 'isAtLeast', 'fallback']

const subset = 'compatible-subset'

export const fallbackScenarios = [
	warm('fallback/unused', 'standard', 'fallback', inputs.valid, { success: true, output: inputs.valid }, { comparisonScope: subset, steps: fallbackSteps }),
	warm('fallback/recovers', 'full', 'fallback', inputs.belowBound, { success: true, output: 0 }, { comparisonScope: subset, steps: fallbackSteps }),
]
