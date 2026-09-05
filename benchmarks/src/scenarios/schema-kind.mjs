// `schema-kind/*`: the initial schemas nothing in the suite measured — `any`,
// `unknown`, `never`, `null`, `undefined`, `bigint`, `symbol`, `instance`, and
// `blob` — plus `json`, which is grouped with them as the last unmeasured schema
// kind even though it is a step on a string rather than an initial schema.
//
// These are the cheapest schemas every library has, so the value of the family is
// not the ranking inside any one row. It is two reference numbers the rest of the
// report is read against, and one failure path nothing else executes:
//
//  1. `any-valid` and `unknown-valid` accept every value and run no check at all,
//     so what they time is each library's per-call overhead with zero validation
//     attached — the floor that every other scenario's number sits on top of. Both
//     are kept even though they do identical work, because they are two separate
//     steps here and two separate schemas in all three competitors. Accepting
//     everything was verified rather than assumed: `undefined` and `null` pass all
//     eight schemas.
//  2. `never-invalid` rejects every value and validates nothing, which makes it the
//     matching floor for the failure path — error construction with no validation
//     work in front of it. That path is where the libraries diverge most, and this
//     is the cleanest place to read its cost alone. It is also the only scenario in
//     the family that declares an issue count: all four report exactly one issue
//     for it (executed, not assumed), and a row that claims to be pure error
//     construction has to hold the diagnostic work fixed or it compares two
//     different amounts of it.
//  3. `json-invalid` is the one failure this family adds beyond `never`, because the
//     `SyntaxError` `JSON.parse` throws and the `catch` that turns it into an issue
//     are a failure path no other scenario in the suite runs.
//
// These two rows are where the intra-process position artefact was isolated, and they
// are the reason every (adapter, scenario) cell now gets its own process. They could
// see it because they are the only rows with no validation work to hide it: measured on
// its own under the previous one-process-per-adapter runner, `unknown-valid` reported
// the same 6.4 ns `any-valid` reports when `any-valid` runs first, and with
// `primitive/valid` in front of both they reported 14.8 and 14.5 ns — the same number
// as each other, which is what said the two rows differed by position rather than by
// schema. It moved the ratio inside a row as well, not only the absolute number:
// Valchecker against Zod 3 read 2.01× in the first position and 2.29× in the second,
// past the 5% the report needs to call an ordering reproducible.
//
// Measured the same two ways with each cell alone in its process, both positions report
// 6.4 ns and the ratio holds at 2.02×. So a floor is now a floor, and the caveat that
// used to belong here applies only to a number from an `adapter`-isolated run.
//
// What the family deliberately leaves out. `any` and `unknown` cannot fail and
// `never` cannot succeed, so neither gets an invented counterpart in the direction
// it does not have. The wrong-typed rejections of `null`, `undefined`, `bigint`,
// `symbol`, `instance`, and `blob` are left out too: each is one comparison plus
// one issue, which is exactly what `primitive/invalid-type` already measures, and a
// scenario has to measure something new rather than rename an existing measurement.
//
// Capability gates, read from the pinned builds:
//
// - `Blob` — Valchecker and Valibot. Neither Zod pin has a blob schema. The
//   existing `file` feature does not cover this and cannot be reused: Zod 4 ships
//   `z.file()` and declares `file`, so a scenario gated that way would demand a
//   build key Zod 4 has no way to provide. Both implementations are
//   `value instanceof Blob`, so the accepted sets match exactly — including a
//   `File`, since every `File` is a `Blob`, and excluding an `ArrayBuffer`, both
//   checked on both adapters.
// - `JSON string validation` — Valchecker only. Zod 3 and Valibot have nothing
//   comparable. Zod 4's `z.json()` is not the same schema and is not paired with
//   it: it is a `lazy` recursive JSON-*value* schema that accepts anything JSON can
//   represent, so it accepts the string `'not json'`, accepts `42`, `null`, arrays,
//   and plain objects, and rejects a `Date` — while `v.string().json()` requires a
//   string and then checks that `JSON.parse` accepts it. Pairing them would compare
//   a recursive structural walk against one native parse call, so Zod 4 is skipped
//   with a reason like the other two.
//
// `instance` needs no gate: `z.instanceof(C)` in both Zod pins and `v.instance(C)`
// in Valibot are built-ins, so no side of the comparison is a user closure standing
// in for one. Zod 3 builds its version on `z.custom()` and reports a `custom` issue
// where the others report a dedicated one, but that is Zod 3's own spelling of the
// built-in and the accepted set is the same `instanceof` test, so the scope stays
// `equivalent`. Every scenario here is `equivalent`: on each participating adapter
// the accepted set, the rejected set, and the preserved output agree exactly.
//
// Two fixture notes. `undefined-valid` deliberately asserts `output: undefined`;
// expectation *presence* decides whether output is checked, so this case catches an
// adapter that returns a successful but incorrect value. And the symbol fixture is
// why `canonicalizeOutput` grew a symbol branch: `JSON.stringify` maps a top-level
// symbol to `undefined` instead of throwing, so before that branch a symbol output
// compared equal to every other symbol and to no output at all.
import { BenchmarkResource } from '../fixtures.mjs'
import { warm } from './define.mjs'

const inputs = {
	// One ordinary value for the two schemas that accept everything and for the one
	// that accepts nothing, so the floor rows share an input.
	anyValue: 'floor',
	empty: null,
	missing: undefined,
	big: 42n,
	// A distinct symbol rather than `Symbol.for`, so the output assertion compares
	// identity against a value nothing else in the suite holds.
	tag: Symbol('schema-kind'),
	resource: new BenchmarkResource('resource-1'),
	blob: new Blob(['benchmark payload'], { type: 'text/plain' }),
	json: '{"id":"resource-1","tags":["a","b"],"size":42}',
	// Truncated after a key, so `JSON.parse` throws where the string is already a
	// valid string: the failure is the JSON check's and not the `string()` check's.
	invalidJson: '{"id":',
}

const blobFeature = ['Blob']
const jsonFeature = ['JSON string validation']

export const schemaKindScenarios = [
	warm('schema-kind/any-valid', 'standard', 'kindAny', inputs.anyValue, { success: true, output: inputs.anyValue }, { conformanceCases: [{ input: null, expected: { success: true, output: null } }, { input: undefined, expected: { success: true, output: undefined } }], conformanceNoFailureReason: '`any` accepts every JavaScript value, so no rejecting input exists.', steps: ['any'] }),
	warm('schema-kind/unknown-valid', 'standard', 'kindUnknown', inputs.anyValue, { success: true, output: inputs.anyValue }, { conformanceCases: [{ input: null, expected: { success: true, output: null } }, { input: undefined, expected: { success: true, output: undefined } }], conformanceNoFailureReason: '`unknown` accepts every JavaScript value, so no rejecting input exists.', steps: ['unknown'] }),
	warm('schema-kind/never-invalid', 'full', 'kindNever', inputs.anyValue, { success: false, issueCount: 1 }, { steps: ['never'] }),

	warm('schema-kind/null-valid', 'standard', 'kindNull', inputs.empty, { success: true, output: inputs.empty }, { conformanceCases: [{ input: undefined, expected: { success: false } }], steps: ['null'] }),
	warm('schema-kind/undefined-valid', 'standard', 'kindUndefined', inputs.missing, { success: true, output: undefined }, { conformanceCases: [{ input: null, expected: { success: false } }], steps: ['undefined'] }),
	warm('schema-kind/bigint-valid', 'standard', 'kindBigint', inputs.big, { success: true, output: inputs.big }, { conformanceCases: [{ input: 42, expected: { success: false } }], steps: ['bigint'] }),
	warm('schema-kind/symbol-valid', 'standard', 'kindSymbol', inputs.tag, { success: true, output: inputs.tag }, { conformanceCases: [{ input: 'not-a-symbol', expected: { success: false } }], steps: ['symbol'] }),
	warm('schema-kind/instance-valid', 'standard', 'kindInstance', inputs.resource, { success: true, output: inputs.resource }, { conformanceCases: [{ input: { id: 'resource-1' }, expected: { success: false } }], steps: ['instance'] }),
	warm('schema-kind/blob-valid', 'standard', 'kindBlob', inputs.blob, { success: true, output: inputs.blob }, { conformanceCases: [{ input: 'not-a-blob', expected: { success: false } }], requiredFeatures: blobFeature, steps: ['blob'] }),

	warm('schema-kind/json-valid', 'standard', 'kindJsonString', inputs.json, { success: true, output: inputs.json }, { requiredFeatures: jsonFeature, steps: ['string', 'json'] }),
	warm('schema-kind/json-invalid', 'full', 'kindJsonString', inputs.invalidJson, { success: false }, { requiredFeatures: jsonFeature, steps: ['string', 'json'] }),
]
