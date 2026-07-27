// `constraint/*`: one scenario pair per built-in constraint validator, plus one
// stacked case. These are a separate module rather than extra entries in an older
// family so every pre-existing scenario keeps its position in the report.
//
// Every validator here exists in all four pinned libraries — Zod spells them as
// schema methods, Valibot as pipe actions — so nothing in this family is gated;
// no scenario declares a required feature. Where the accepted sets differ in
// detail the scenario declares `compatible-subset` and the difference is named at
// the fixture or in the adapter build.
//
// Two things the fixtures deliberately stay away from. `v.number()` is a `typeof`
// check that admits `NaN` and `±Infinity`, Zod 3's rejects `NaN`, Zod 4's rejects
// both, and Valibot's rejects `NaN`; the numeric bound fixtures are therefore all
// ordinary finite numbers, which is also how every pre-existing numeric scenario
// in the suite treats that difference. And a value that is merely of the wrong
// type would fail before reaching the constraint, so each invalid fixture is a
// value of the right type sitting just outside the bound under test.
import { warm } from './define.mjs'

const numbers = {
	// `isAtMost(100)` / `max(100)` / `maxValue(100)`: inclusive in all four.
	atMost: 42,
	atMostInvalid: 101,
	// `isGreaterThan(0)` / `gt(0)` / `gtValue(0)`: strict in all four, unlike the
	// inclusive `isAtLeast`/`min`/`minValue` family, so the exact bound is the
	// nearest rejected value.
	greaterThan: 42,
	greaterThanInvalid: 0,
	// `isLessThan(100)` / `lt(100)` / `ltValue(100)`: strict in all four.
	lessThan: 42,
	lessThanInvalid: 100,
	// Divisor 5. A decimal divisor was rejected as a fixture: Valchecker, Zod 3,
	// and Zod 4 apply a floating-point tolerance and accept `0.3` as a multiple of
	// `0.1`, while Valibot's `multipleOf()` is an exact `%` remainder check and
	// rejects it — and rejects `1` as a multiple of `0.1` too. An integer divisor
	// is the region where all four agree.
	multipleOf: 15,
	multipleOfInvalid: 12,
	finite: 1.5,
	// Rejected by `isFinite()`/`finite()` in Valchecker, Zod 3, and Valibot, and
	// already by `z.number()` in Zod 4 — see the scope note on the scenario.
	finiteInvalid: Number.POSITIVE_INFINITY,
	safeInteger: 42,
	// `2 ** 53`, the first integer past the safe range. A non-integer was rejected
	// as a fixture: Zod 3's `.safe()` only bounds the range and accepts `1.5`.
	safeIntegerInvalid: 2 ** 53,
	nan: Number.NaN,
	nanInvalid: 1,
}

const strings = {
	startingWith: 'user-1024',
	// Same shape, different prefix.
	startingWithInvalid: 'admin-1024',
	endingWith: 'avatar.png',
	endingWithInvalid: 'avatar.jpg',
	including: 'ada@example.com',
	includingInvalid: 'ada@sample.com',
	// Length 6 counted in UTF-16 code units, which is what all four count.
	lengthExactly: 'a1b2c3',
	lengthExactlyInvalid: 'a1b2c',
	notEmpty: 'ada',
	notEmptyInvalid: '',
	empty: '',
	emptyInvalid: 'a',
	equalTo: 'admin',
	equalToInvalid: 'user',
	// Passes the two length bounds, the prefix, and the suffix, and fails only the
	// last of the five stacked constraints, so the invalid case traverses the whole
	// stack.
	stack: 'avatars/user-1024.png',
	stackInvalid: 'avatars/team-1024.png',
}

const sets = {
	// Size 3 is the accepted value for all three size bounds at once.
	three: new Set(['read', 'write', 'admin']),
	// One member short of `isSizeAtLeast(3)`.
	two: new Set(['read', 'write']),
	// One member past `isSizeAtMost(3)` and `isSizeExactly(3)`.
	four: new Set(['read', 'write', 'admin', 'audit']),
}

const atMostSteps = ['number', 'isAtMost']
const greaterThanSteps = ['number', 'isGreaterThan']
const lessThanSteps = ['number', 'isLessThan']
const multipleOfSteps = ['number', 'isMultipleOf']
const finiteSteps = ['number', 'isFinite']
const safeIntegerSteps = ['number', 'isSafeInteger']
const nanSteps = ['number', 'isNaN']
const startingWithSteps = ['string', 'isStartingWith']
const endingWithSteps = ['string', 'isEndingWith']
const includingSteps = ['string', 'isIncluding']
const lengthExactlySteps = ['string', 'isLengthExactly']
const notEmptySteps = ['string', 'isNotEmpty']
const emptySteps = ['string', 'isEmpty']
const equalToSteps = ['string', 'isEqualTo']
const sizeAtLeastSteps = ['set', 'string', 'isSizeAtLeast']
const sizeAtMostSteps = ['set', 'string', 'isSizeAtMost']
const sizeExactlySteps = ['set', 'string', 'isSizeExactly']
const stackSteps = ['string', 'isLengthAtLeast', 'isLengthAtMost', 'isStartingWith', 'isEndingWith', 'isIncluding']

const subset = 'compatible-subset'

export const constraintScenarios = [
	warm('constraint/at-most-valid', 'standard', 'constraintAtMost', numbers.atMost, { success: true, output: numbers.atMost }, { steps: atMostSteps }),
	warm('constraint/at-most-invalid', 'full', 'constraintAtMost', numbers.atMostInvalid, { success: false }, { steps: atMostSteps }),
	warm('constraint/greater-than-valid', 'standard', 'constraintGreaterThan', numbers.greaterThan, { success: true, output: numbers.greaterThan }, { steps: greaterThanSteps }),
	warm('constraint/greater-than-invalid', 'full', 'constraintGreaterThan', numbers.greaterThanInvalid, { success: false }, { steps: greaterThanSteps }),
	warm('constraint/less-than-valid', 'standard', 'constraintLessThan', numbers.lessThan, { success: true, output: numbers.lessThan }, { steps: lessThanSteps }),
	warm('constraint/less-than-invalid', 'full', 'constraintLessThan', numbers.lessThanInvalid, { success: false }, { steps: lessThanSteps }),

	// `compatible-subset`: the four agree on integer divisors and disagree on
	// decimal ones, because only Valibot uses exact remainder arithmetic.
	warm('constraint/multiple-of-valid', 'standard', 'constraintMultipleOf', numbers.multipleOf, { success: true, output: numbers.multipleOf }, { comparisonScope: subset, steps: multipleOfSteps }),
	warm('constraint/multiple-of-invalid', 'full', 'constraintMultipleOf', numbers.multipleOfInvalid, { success: false }, { comparisonScope: subset, steps: multipleOfSteps }),

	// `compatible-subset`: the composed schemas accept and reject the same values,
	// but not at the same place. `z.number()` in Zod 4 already excludes non-finite
	// input, so its `finite()` is redundant and the Zod 4 failure cell measures a
	// base type check rather than a constraint.
	warm('constraint/finite-valid', 'standard', 'constraintFinite', numbers.finite, { success: true, output: numbers.finite }, { comparisonScope: subset, steps: finiteSteps }),
	warm('constraint/finite-invalid', 'full', 'constraintFinite', numbers.finiteInvalid, { success: false }, { comparisonScope: subset, steps: finiteSteps }),

	// `compatible-subset`: Zod 3's `.safe()` is a safe-integer *range* check with
	// no integrality requirement, so it accepts non-integers the other three
	// reject. The fixtures are integers, where all four agree.
	warm('constraint/safe-integer-valid', 'standard', 'constraintSafeInteger', numbers.safeInteger, { success: true, output: numbers.safeInteger }, { comparisonScope: subset, steps: safeIntegerSteps }),
	warm('constraint/safe-integer-invalid', 'full', 'constraintSafeInteger', numbers.safeIntegerInvalid, { success: false }, { comparisonScope: subset, steps: safeIntegerSteps }),

	// `compatible-subset`: Valchecker validates the number and then `NaN`-ness,
	// while Zod and Valibot dispatch a single dedicated `nan()` schema. The
	// accepted set is the same one value. No `output` is asserted, because
	// `JSON.stringify(NaN)` is `null` on both sides and would assert nothing.
	warm('constraint/nan-valid', 'standard', 'constraintNaN', numbers.nan, { success: true }, { comparisonScope: subset, steps: nanSteps }),
	warm('constraint/nan-invalid', 'full', 'constraintNaN', numbers.nanInvalid, { success: false }, { comparisonScope: subset, steps: nanSteps }),

	warm('constraint/starting-with-valid', 'standard', 'constraintStartingWith', strings.startingWith, { success: true, output: strings.startingWith }, { steps: startingWithSteps }),
	warm('constraint/starting-with-invalid', 'full', 'constraintStartingWith', strings.startingWithInvalid, { success: false }, { steps: startingWithSteps }),
	warm('constraint/ending-with-valid', 'standard', 'constraintEndingWith', strings.endingWith, { success: true, output: strings.endingWith }, { steps: endingWithSteps }),
	warm('constraint/ending-with-invalid', 'full', 'constraintEndingWith', strings.endingWithInvalid, { success: false }, { steps: endingWithSteps }),
	warm('constraint/including-valid', 'standard', 'constraintIncluding', strings.including, { success: true, output: strings.including }, { steps: includingSteps }),
	warm('constraint/including-invalid', 'full', 'constraintIncluding', strings.includingInvalid, { success: false }, { steps: includingSteps }),
	warm('constraint/length-exactly-valid', 'standard', 'constraintLengthExactly', strings.lengthExactly, { success: true, output: strings.lengthExactly }, { steps: lengthExactlySteps }),
	warm('constraint/length-exactly-invalid', 'full', 'constraintLengthExactly', strings.lengthExactlyInvalid, { success: false }, { steps: lengthExactlySteps }),
	warm('constraint/not-empty-valid', 'standard', 'constraintNotEmpty', strings.notEmpty, { success: true, output: strings.notEmpty }, { steps: notEmptySteps }),
	warm('constraint/not-empty-invalid', 'full', 'constraintNotEmpty', strings.notEmptyInvalid, { success: false }, { steps: notEmptySteps }),

	// `compatible-subset`: neither Zod version has an `.empty()` action, so the Zod
	// side is `.length(0)` — the same `length === 0` predicate, still a built-in.
	warm('constraint/empty-valid', 'standard', 'constraintEmpty', strings.empty, { success: true, output: strings.empty }, { comparisonScope: subset, steps: emptySteps }),
	warm('constraint/empty-invalid', 'full', 'constraintEmpty', strings.emptyInvalid, { success: false }, { comparisonScope: subset, steps: emptySteps }),

	// `compatible-subset`, for the reason `membership/*` already carries: Valchecker
	// validates the string and then equality, while the competitors dispatch a
	// single `literal()` schema. Valchecker's own one-step `literal()` exists, but
	// this scenario is here to measure `isEqualTo`.
	warm('constraint/equal-to-valid', 'standard', 'constraintEqualTo', strings.equalTo, { success: true, output: strings.equalTo }, { comparisonScope: subset, steps: equalToSteps }),
	warm('constraint/equal-to-invalid', 'full', 'constraintEqualTo', strings.equalToInvalid, { success: false }, { comparisonScope: subset, steps: equalToSteps }),

	warm('constraint/size-at-least-valid', 'standard', 'constraintSizeAtLeast', sets.three, { success: true, output: sets.three }, { steps: sizeAtLeastSteps }),
	warm('constraint/size-at-least-invalid', 'full', 'constraintSizeAtLeast', sets.two, { success: false }, { steps: sizeAtLeastSteps }),
	warm('constraint/size-at-most-valid', 'standard', 'constraintSizeAtMost', sets.three, { success: true, output: sets.three }, { steps: sizeAtMostSteps }),
	warm('constraint/size-at-most-invalid', 'full', 'constraintSizeAtMost', sets.four, { success: false }, { steps: sizeAtMostSteps }),
	warm('constraint/size-exactly-valid', 'standard', 'constraintSizeExactly', sets.three, { success: true, output: sets.three }, { steps: sizeExactlySteps }),
	warm('constraint/size-exactly-invalid', 'full', 'constraintSizeExactly', sets.four, { success: false }, { steps: sizeExactlySteps }),

	// Five constraints on one string field. The single-constraint scenarios above
	// each measure one library's cheapest possible refinement, which is also where
	// the competitors' bare-schema fast path is already lost; this scenario is what
	// says how the cost grows once a field carries the several constraints a real
	// schema gives it.
	warm('constraint/stack-valid', 'standard', 'constraintStack', strings.stack, { success: true, output: strings.stack }, { steps: stackSteps }),
	warm('constraint/stack-invalid', 'full', 'constraintStack', strings.stackInvalid, { success: false }, { steps: stackSteps }),
]
