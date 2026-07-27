// `serialization/*`: `toJSONValue` and `toJSONString`, the two steps that cross
// between a JavaScript value and JSON text. They are separated from
// `collection-transform/*` because they are the only transformations added
// alongside it that can fail for a reason of their own, and both failures are
// comparable against Valibot.
//
// Who participates, and why:
//
// - **valid.** All five adapters. Valchecker uses the built-in steps, Valibot the
//   built-in `parseJson()`/`stringifyJson()` actions, and Zod a `transform` around
//   `JSON.parse`/`JSON.stringify`. The Zod callbacks wrap the function rather than
//   passing it, because Zod calls a transform with `(value, ctx)` and the second
//   parameter of both natives is a reviver and a replacer.
// - **invalid.** Valchecker and Valibot, gated on
//   `JSON conversion failure reporting`. Executed on both Zod pins: the parse
//   callback lets `JSON.parse`'s `SyntaxError` escape `safeParse`, and the stringify
//   callback lets the circular-structure `TypeError` escape, so the scenario cannot
//   be expressed there at all. This is the same gate `coercion/*` applies to
//   `v.transform(BigInt)`, in the same direction: the competitor throws where the
//   step under test reports.
//
// `compatible-subset` on all four, and for `toJSONString` the reason is
// substantial. Read from `packages/internal/src/steps/toJSONString/toJSONString.ts`
// and stated in `docs/guide/v1-contract.md`: the step performs a single-read
// preflight walk over own enumerable JSON properties and only then calls
// `JSON.stringify`, so the valid path traverses the value twice where Valibot and
// Zod traverse it once. The preflight is what buys the contract — a cycle, a
// bigint, a symbol, a function, an explicit `undefined`, or an array hole becomes a
// structured issue carrying the nested `at` path, where `JSON.stringify` would
// throw, omit the key, or coerce the hole to `null`. Comparing that against a bare
// native call and calling it equivalent would be exactly the mistake the earlier
// batches were fixing, so the extra work is named here instead. Making the
// competitors do it is not an option: a preflight written into an adapter closure
// would be a hand-rolled stand-in for a built-in, which the suite refuses to build.
//
// The two `json-string-*` rows are the two ends of that one decision, and measured
// at the standard profile they are large and stable (RME under 1% on both
// adapters): serializing the valid payload costs Valchecker 1,274.9 ns against
// Valibot's 218.5 ns, while rejecting the cycle costs Valchecker 252.3 ns against
// Valibot's 4,157.6 ns, because the preflight decides without a throw where
// `JSON.stringify` raises a `TypeError` and Valibot pays to construct it. Neither
// row is the whole story on its own; quote them together.
//
// `toJSONValue` needs no such note — it is `JSON.parse` in a `try`/`catch`, and so
// is Valibot's `parseJson()`. Both `json-value-*` rows land within about 6% of each
// other, and the invalid one is dominated by the `SyntaxError` itself rather than by
// either library (3,692.2 ns against 3,895.2 ns).
//
// The fixtures are chosen so that the *reported* behavior agrees on every
// participating adapter, verified by execution:
//
// - the valid object is plain JSON data, so all five return the identical string,
//   key order included;
// - the invalid JSON text is truncated after a key, so `JSON.parse` throws where
//   the input is already a valid string — the failure belongs to the step and not
//   to the `string()` check in front of it;
// - the unserializable value is a self-referencing object. Valchecker reports
//   `toJSONString:unserializable` from the preflight, Valibot reports its `JSON`
//   issue from the caught `TypeError`, and neither returns a value. A bigint would
//   also fail on both, but a cycle is the case both libraries detect for the same
//   reason rather than by two unrelated rules.
//
// Not measured: the paths where the two disagree. An explicit `undefined` property
// or an array hole fails on Valchecker and silently succeeds on Valibot and Zod, so
// there is no fixture all three agree on and no honest row to put it in;
// `toJSONString`'s `serialization_failed` operation issue needs a throwing getter,
// `toJSON`, or Proxy trap, which is again a Valchecker-only failure. Both are
// covered by `packages/internal/src/steps/toJSONString/toJSONString.bench.ts`.
import { warm } from './define.mjs'

function createCyclic() {
	const cyclic = { id: 'resource-1' }
	cyclic.self = cyclic
	return cyclic
}

const inputs = {
	// Plain JSON data: four own enumerable properties, one nested array, no value
	// whose JSON representation the libraries dispute. It is also the expected output
	// of the parse scenario, so the two directions cannot drift apart.
	value: Object.freeze({ id: 'resource-1', tags: ['a', 'b'], size: 42, enabled: true }),
	// The same payload as text, in the key order `JSON.stringify` produces for the
	// object above.
	text: '{"id":"resource-1","tags":["a","b"],"size":42,"enabled":true}',
	// Truncated after a key: a valid string that is not valid JSON.
	invalidText: '{"id":',
	// A self-reference, so it cannot be written as a frozen literal.
	cyclic: createCyclic(),
}

const jsonValueSteps = ['string', 'toJSONValue']
const jsonStringSteps = ['unknown', 'toJSONString']

const subset = 'compatible-subset'
const failureReporting = ['JSON conversion failure reporting']

export const serializationScenarios = [
	warm('serialization/json-value-valid', 'standard', 'jsonValue', inputs.text, { success: true, output: inputs.value }, { comparisonScope: subset, steps: jsonValueSteps }),
	warm('serialization/json-value-invalid', 'full', 'jsonValue', inputs.invalidText, { success: false }, { comparisonScope: subset, requiredFeatures: failureReporting, steps: jsonValueSteps }),

	warm('serialization/json-string-valid', 'standard', 'jsonString', inputs.value, { success: true, output: inputs.text }, { comparisonScope: subset, steps: jsonStringSteps }),
	warm('serialization/json-string-invalid', 'full', 'jsonString', inputs.cyclic, { success: false }, { comparisonScope: subset, requiredFeatures: failureReporting, steps: jsonStringSteps }),
]
