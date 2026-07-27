// `standard-schema/*`: the Standard Schema V1 entry point, `schema['~standard']
// .validate(input)`. All four libraries implement it, and users of tRPC, TanStack
// Form, and similar libraries reach a schema through it rather than through the
// library's own `parse`, so it is a production path the suite measured nowhere: every
// other scenario calls the native entry (`execute`, `safeParse`, `safeParseAsync`).
//
// Every scenario here reuses an existing build key — `primitive`, `flatObject`,
// `asyncCheck` — and changes nothing but the entry point, so each row pairs with a
// native row over the identical schema and fixture and the difference between them is
// the interop layer. The pairs are `primitive/valid`, `primitive/invalid-late`,
// `flat-object/valid`, and `async/check-valid`; read them from the same run, because
// only one run's environment and sampling budget describe both sides.
//
// What the entry point actually does, read from each implementation:
//
// - **Valchecker** (`packages/internal/src/core/core.ts`): every instance carries
//   `'~standard' = { version: 1, vendor: 'valchecker', validate: execute }`, where
//   `execute` is the *same function object* the public `execute` property holds —
//   `schema['~standard'].validate === schema.execute` is `true`. The public result is
//   already `{ value }` or `{ issues }`, which is the Standard Schema result, so the
//   interop layer is an alias and costs nothing by construction. `execution-strategy
//   .test.ts` and `standardSchema.test.ts` cover it.
// - **Zod** (both pins): `validate` calls the synchronous parse inside a `try`, and
//   on a throw falls back to the asynchronous parse, then rebuilds the result as
//   `{ value }` or `{ issues }`. For a synchronous schema that is a `try` block and
//   one object; for an asynchronous one it is a thrown-and-caught error on every
//   single call before the async parse even starts, which is what
//   `standard-schema/async-check-valid` measures.
// - **Valibot**: `validate` runs the schema's standard props and returns the internal
//   dataset, so a *typed* failure comes back as `{ value, typed: true, issues }` —
//   with a `value` present. Success is therefore the absence of `issues`, exactly as
//   the specification says, and the harness normalizes it that way for all four
//   rather than testing for a `value`. This is the one place where the four results
//   are not the same object shape, and it is handled once in
//   `scenarios/define.mjs` because Standard Schema is one contract, not four
//   spellings.
//
// Can `~standard.validate` return a promise? On all four, yes, and only for a schema
// whose work is asynchronous: Valchecker's is `execute`, so it returns a promise
// exactly when the pipeline does; Zod's async fallback returns one; Valibot's returns
// the promise its async props produce. So the entry point does not decide the
// execution mode — the schema does — and each scenario here declares the mode of the
// schema it reuses. `standard-schema/async-check-valid` is the async one and is
// measured with the await inside the timed loop like every other `async` cell; the
// other three are synchronous.
//
// How to read the native/standard pair, and how not to. Measured *alone* at the
// standard profile — which needed a deliberate one-scenario-per-process run at the
// time and is now what every cell gets, so the intra-process position artefact could
// not masquerade as interop cost — the valid path costs: Valchecker 62.9/62.1 ns
// native against 61.5/62.0 ns standard (two runs each, RME under 1.3%: no measurable
// difference, which is what a function alias should show), Zod 3 61.6 → 62.5 ns, Zod 4
// 93.4 → 100.9 ns, and Valibot 94.4 → 110.5 ns. Under the old one-process-per-adapter
// runner the same twelve-scenario smoke selection read the Valchecker pair as
// 61.7 → 87.8 ns, and that 26 ns was position rather than interop — the finding that
// made cell isolation worth its cost. So: quote the delta from one run, and treat the
// figures above as pre-2026-07-28 numbers when the question is the size of the interop
// layer itself.
//
// Scope. `equivalent` throughout: the accepted sets, outputs, and failure positions
// are those of the reused build keys, which already agree, and the entry point is a
// specified contract every participant implements rather than an approximation of one
// library's API. What differs is how much each implementation does to satisfy it,
// which is the measurement.
//
// Nothing is gated. All four expose `~standard` on every schema in this file,
// confirmed by execution on the pinned versions.
import { flatObject, primitive } from '../fixtures.mjs'
import { warm } from './define.mjs'

const standardEntry = { entry: 'standard' }

// The build keys' own step declarations, which the scenario tests require to match
// the native scenarios sharing each key.
const primitiveSteps = ['string', 'isLengthAtLeast', 'isLengthAtMost', 'check']
const flatObjectSteps = ['object', 'string', 'number', 'isInteger', 'isAtLeast', 'boolean', 'literal', 'check']
const asyncCheckSteps = ['string', 'check']

export const standardSchemaScenarios = [
	// The cheapest schema in the suite, where a fixed per-call interop cost is the
	// largest share of the number.
	warm('standard-schema/primitive-valid', 'standard', 'primitive', primitive.valid, { success: true, output: primitive.valid }, { ...standardEntry, steps: primitiveSteps }),
	// The failure direction: the interop layer also has to hand back issues.
	// `invalidLate` fails at the final predicate, so the row includes the same
	// validation work `primitive/invalid-late` measures and differs only in the exit.
	warm('standard-schema/primitive-invalid', 'full', 'primitive', primitive.invalidLate, { success: false }, { ...standardEntry, steps: primitiveSteps }),
	// A ten-field object, so the pair with the primitive row shows whether the interop
	// cost is fixed per call or grows with the work.
	warm('standard-schema/flat-object-valid', 'standard', 'flatObject', flatObject.valid, { success: true }, { ...standardEntry, steps: flatObjectSteps }),
	// The interop entry over an asynchronous schema, which is where the three
	// implementations diverge most: an alias on Valchecker against a caught throw per
	// call on both Zod pins.
	warm('standard-schema/async-check-valid', 'standard', 'asyncCheck', primitive.valid, { success: true, output: primitive.valid }, { ...standardEntry, executionMode: 'async', steps: asyncCheckSteps }),
]
