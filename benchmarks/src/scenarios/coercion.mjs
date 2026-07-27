// `coercion/*`: the coercing initial schemas and the conversion steps. Reading a
// query string, a form body, or an environment variable is one of the largest
// real uses of a validation library and none of it was measured before this
// module. A separate module rather than extra entries in an older family so every
// pre-existing scenario keeps its position in the report.
//
// Three things shape the family, all established by executing the fixtures rather
// than assuming:
//
// 1. Nobody's coercion accepts the same set. `looseNumber()` follows TypeScript's
//    `${number}` grammar, so it rejects `''`, `'NaN'`, `'Infinity'`, booleans and
//    `null`; `z.coerce.number()` performs no input type check at all and accepts
//    `''`, booleans and `null`, with Zod 3 accepting `'Infinity'` as well and both
//    pins rejecting `'NaN'`; Valibot's pipe accepts strings only. Every fixture
//    below sits in the intersection, and each scenario declares
//    `compatible-subset`.
// 2. Valibot has no coercing schema. `v.pipe(v.string(), v.transform(Number), …)`
//    is not a hand-rolled stand-in for a Valibot built-in, because there is no
//    built-in to stand in for — it is what a Valibot user writes. It is therefore
//    included, with the callback named in the scope note, rather than dropped;
//    excluding it would report "Valibot cannot coerce", which is false. Where the
//    same idiom cannot express the *failure* — `v.transform(BigInt)` throws a
//    `SyntaxError` out of `safeParse` instead of producing an issue — the family is
//    gated instead, because there the comparison would be unsound, not merely
//    asymmetric.
// 3. Most conversions cannot fail. `Number('abc')` is `NaN` rather than a throw and
//    `toNumber` documents that it follows native semantics, so `toNumber`,
//    `toBoolean`, and `toString` fail only when the type check their chain starts
//    with fails — a number's own `toString` cannot throw, which is the only other
//    failure `toString` has. That check is not conversion work and the suite measures
//    it already: `primitive/invalid-type` and `transform/invalid-type` both measure
//    `v.string()` rejecting a non-string, the second one in front of a
//    transformation chain. So the string-input conversions get no invalid twin, and
//    the one type-check failure this module adds is the *number* check in front of
//    `toString`, which no existing scenario measures. `toBigint`'s own
//    `conversion_failed` path is real but has no competitor: the three competitor
//    spellings throw where Valchecker reports an issue, and the closest comparable
//    rejection is `coercion/loose-bigint-invalid` below.
//
// `toSafeNumber` is measured here too, and was wrongly excluded before. It converts
// a bigint to a number only inside the safe integer range, and all three pinned
// libraries express that with built-ins: `z.bigint().transform(Number).pipe(z.number()
// .safe())` on both Zod pins and `v.pipe(v.bigint(), v.transform(Number),
// v.safeInteger())` on Valibot. The order is reversed — Valchecker range-checks the
// bigint and then converts, the competitors convert and then range-check — but the
// decision is not, because `Number(bigint)` rounds to a double outside the safe range
// exactly when the bigint was outside it. Executed rather than argued: the four agree on
// 42n, 2n**53n-1n, 2n**53n, ±2n**60n, and on 500,000 random bigints spanning the
// boundary, with zero divergence in accept, reject, output, or issue count. The earlier
// exclusion rested on two false claims — that `z.coerce.number()` was the only Zod
// spelling, and that `Number(2n ** 60n)` loses precision; it is exactly 2^60, printed as
// 1152921504606847000 only because that is the shortest round-tripping decimal.
import { mappedBooleanValues } from '../fixtures.mjs'
import { warm } from './define.mjs'

const inputs = {
	// Accepted by all three coercions and by `Number()`; `'  '` would be accepted
	// too, but only because TypeScript's grammar treats a whitespace-only string as
	// `0`, which is not what a query string means.
	numberText: '42',
	// `Number('abc')` is `NaN`. `looseNumber()` and `z.coerce.number()` reject it
	// inside the coercion; Valibot needs the trailing `v.number()` for that, which
	// is why its build has one. `''` was rejected as a fixture: `Number('')` is `0`,
	// so Zod and Valibot accept it and Valchecker does not.
	notNumberText: 'abc',
	// The discriminating boolean fixture, and the reason `z.coerce.boolean()` is not
	// the comparison: it is `Boolean()` truthiness, so it maps this string to `true`.
	// `z.stringbool()` and `looseBoolean()` both map it to `false`. The same string
	// appears in `coercion/to-boolean-valid` producing `true`, which is exactly the
	// difference between parsing a boolean and testing truthiness.
	booleanText: 'false',
	// Rejected by `looseBoolean()` and by `z.stringbool()`; `z.coerce.boolean()`
	// would accept it as `true`.
	notBooleanText: 'maybe',
	bigintText: '42',
	// Rejected by `looseBigint()` and `z.coerce.bigint()`. `''` was rejected as a
	// fixture for the same reason as the number case: `BigInt('')` is `0n`.
	notBigintText: 'abc',
	number255: 255,
	// The same digits as a string, which is what `v.number()` rejects: the only
	// failure a conversion chain starting with a number check has.
	notNumber: '255',
	// The first configured true value, taken from the list both adapters build their
	// mapping from, so the fixture cannot drift away from the mapping under test.
	mappedText: mappedBooleanValues.trueValues[0],
	// The largest bigint every participant converts, so the valid row sits on the
	// boundary rather than somewhere comfortably inside it.
	safeBigint: 2n ** 53n - 1n,
	// One above the boundary would also do; 2^60 is used because it is the value the
	// removed allowlist entry claimed was converted with silent precision loss. It is
	// converted exactly, and rejected by all four for being out of range.
	unsafeBigint: 2n ** 60n,
	// Matches no configured mapping on either side. `'YES'` was rejected as a
	// fixture: `stringbool()` lowercases its input by default, so the adapter
	// configures `case: 'sensitive'` to match `toMappedBoolean()`, and a fixture
	// that depends on that setting would hide the difference rather than avoid it.
	unmappedText: 'maybe',
}

const looseNumberSteps = ['looseNumber']
const looseBooleanSteps = ['looseBoolean']
const looseBigintSteps = ['looseBigint']
const convertNumberSteps = ['string', 'toNumber']
const convertBooleanSteps = ['string', 'toBoolean']
const convertBigintSteps = ['string', 'toBigint']
const convertStringSteps = ['number', 'toString']
const safeNumberSteps = ['bigint', 'toSafeNumber']
const mappedBooleanSteps = ['string', 'toMappedBoolean']

const subset = 'compatible-subset'
const booleanStringParsing = ['boolean string parsing']
const bigintCoercion = ['bigint coercion']

export const coercionScenarios = [
	// The coercing initial schemas: one step that both admits its own type and
	// parses a string.
	warm('coercion/loose-number-valid', 'standard', 'looseNumber', inputs.numberText, { success: true, output: 42 }, { comparisonScope: subset, steps: looseNumberSteps }),
	warm('coercion/loose-number-invalid', 'full', 'looseNumber', inputs.notNumberText, { success: false }, { comparisonScope: subset, steps: looseNumberSteps }),

	// Gated on `boolean string parsing`: Zod 4's `stringbool()` is the only
	// competitor that parses a boolean out of a string. Zod 3 has none, and a
	// hand-written mapping table would be a stand-in for a built-in rather than an
	// idiom — unlike delegating to native `Number()`, there is no native function to
	// delegate to. `stringbool()` accepts `'1'`, `'yes'`, `'on'` and lowercases its
	// input, and rejects the real booleans `looseBoolean()` accepts, so the scope is
	// `compatible-subset` and the fixtures are lowercase.
	warm('coercion/loose-boolean-valid', 'standard', 'looseBoolean', inputs.booleanText, { success: true, output: false }, { comparisonScope: subset, requiredFeatures: booleanStringParsing, steps: looseBooleanSteps }),
	warm('coercion/loose-boolean-invalid', 'full', 'looseBoolean', inputs.notBooleanText, { success: false }, { comparisonScope: subset, requiredFeatures: booleanStringParsing, steps: looseBooleanSteps }),

	// Gated on `bigint coercion`: both Zod pins have `z.coerce.bigint()`, which
	// reports an issue for an unparseable string, while Valibot's only spelling
	// throws out of `safeParse`.
	warm('coercion/loose-bigint-valid', 'standard', 'looseBigint', inputs.bigintText, { success: true, output: 42n }, { comparisonScope: subset, requiredFeatures: bigintCoercion, steps: looseBigintSteps }),
	warm('coercion/loose-bigint-invalid', 'full', 'looseBigint', inputs.notBigintText, { success: false }, { comparisonScope: subset, requiredFeatures: bigintCoercion, steps: looseBigintSteps }),

	// The conversion steps. `compatible-subset` throughout: the accepted sets and
	// the outputs agree exactly, but Valchecker converts with a built-in step where
	// Zod and Valibot must wrap the same native function in a user callback, which
	// is the only way either of them expresses a conversion that keeps its input
	// type check. `z.coerce.*` has no input type check, so it is not that spelling.
	warm('coercion/to-number-valid', 'standard', 'convertNumber', inputs.numberText, { success: true, output: 42 }, { comparisonScope: subset, steps: convertNumberSteps }),
	// `'false'` converts to `true`: `toBoolean` is native truthiness, which is what
	// `toMappedBoolean` and `looseBoolean` exist to avoid.
	warm('coercion/to-boolean-valid', 'standard', 'convertBoolean', inputs.booleanText, { success: true, output: true }, { comparisonScope: subset, steps: convertBooleanSteps }),
	warm('coercion/to-bigint-valid', 'standard', 'convertBigint', inputs.bigintText, { success: true, output: 42n }, { comparisonScope: subset, steps: convertBigintSteps }),
	// `toString` delegates to the value's own `toString`; `String(value)` is the
	// competitor spelling and agrees for a number. Its `radix` option has no
	// competitor equivalent and is deliberately not used here.
	warm('coercion/to-string-valid', 'standard', 'convertString', inputs.number255, { success: true, output: '255' }, { comparisonScope: subset, steps: convertStringSteps }),
	// The one type-check failure this module adds, for the reason in the header:
	// every conversion here fails only where its leading type check fails, the
	// string check is already measured by `primitive/invalid-type` and
	// `transform/invalid-type`, and the number check is measured nowhere.
	warm('coercion/to-string-invalid-type', 'full', 'convertString', inputs.notNumber, { success: false }, { comparisonScope: subset, steps: convertStringSteps }),
	// `toSafeNumber` against each competitor's conversion piped into its own safe-range
	// check. `compatible-subset` for the reason every other `coercion/to-*` row carries —
	// the competitors reach the same decision through a user callback plus a second
	// schema — with the guard's position reversed as well, which is the difference the
	// header records. The invalid row is the one conversion failure in this family that
	// belongs to the step rather than to a leading type check, so unlike the other
	// conversions it has a real invalid twin.
	warm('coercion/to-safe-number-valid', 'standard', 'safeNumber', inputs.safeBigint, { success: true, output: Number.MAX_SAFE_INTEGER }, { comparisonScope: subset, steps: safeNumberSteps }),
	warm('coercion/to-safe-number-invalid', 'full', 'safeNumber', inputs.unsafeBigint, { success: false, issueCount: 1 }, { comparisonScope: subset, steps: safeNumberSteps }),

	// `toMappedBoolean` against `stringbool()` configured with the same two lists.
	// `compatible-subset` for the reason `constraint/equal-to` carries: Valchecker
	// validates the string and then maps it, while Zod dispatches one schema that
	// does both.
	warm('coercion/mapped-boolean-valid', 'standard', 'mappedBoolean', inputs.mappedText, { success: true, output: true }, { comparisonScope: subset, requiredFeatures: booleanStringParsing, steps: mappedBooleanSteps }),
	warm('coercion/mapped-boolean-invalid', 'full', 'mappedBoolean', inputs.unmappedText, { success: false }, { comparisonScope: subset, requiredFeatures: booleanStringParsing, steps: mappedBooleanSteps }),
]
