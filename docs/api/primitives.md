# Primitives

Primitive initial steps check JavaScript and TypeScript identities. Message-bearing methods use a trailing options object, for example `string({ message })`, `literal(value, { message })`, and `isAtLeast(minimum, { message })`.

## Initial schemas

| Step | Successful domain | Issue code |
| --- | --- | --- |
| `string()` | `typeof value === 'string'` | `string:expected_string` |
| `number()` | every JavaScript number, including `NaN` and infinities | `number:expected_number` |
| `boolean()` | booleans | `boolean:expected_boolean` |
| `bigint()` | bigints | `bigint:expected_bigint` |
| `symbol()` | symbols | `symbol:expected_symbol` |
| `literal(value)` | `Object.is(value, expected)` | `literal:expected_literal` |
| `null()` | `null` | `null:expected_null` |
| `undefined()` | `undefined` | `undefined:expected_undefined` |
| `unknown()` | every value, output `unknown` | none |
| `any()` | every value, output `any` | none |
| `never()` | never succeeds | `never:expected_never` |

`number()` deliberately has no hidden finite-number policy:

```ts
const nanResult = v.number()
	.execute(Number.NaN) // success
const infinityResult = v.number()
	.execute(Infinity) // success
const finiteInfinityResult = v.number()
	.isFinite()
	.execute(Infinity) // failure
```

## Loose primitives

Loose primitives accept the primitive or its corresponding TypeScript-template-compatible string representation, then normalize output:

- `looseNumber()` — ``number | `${number}``` → `number`; issue `looseNumber:expected_number`
- `looseBoolean()` — ``boolean | `${boolean}``` → `boolean`; issue `looseBoolean:expected_boolean`
- `looseBigint()` — ``bigint | `${bigint}``` → `bigint`; issue `looseBigint:expected_bigint`

They do not perform unrestricted JavaScript coercion. A non-empty whitespace-only string is a valid loose number and normalizes to `0`; the empty string is invalid. Loose booleans accept only `"true"` and `"false"`.

## Template literals

`templateLiteral(parts, options?)` validates a string against an assembled TypeScript template-literal type and infers that exact output type. Parts are interpolatable literals or bare interpolatable initial schemas (`string`, `number`, `bigint`, `boolean`, `literal`, `null`, `undefined`, `union`, or nested `templateLiteral`). Union parts expand as a cross product.

```ts
v.templateLiteral(['ID-', v.number()]) // output `ID-${number}`
v.templateLiteral([v.number(), v.union(['px', 'em'])])
// output `${number}px` | `${number}em`
```

Matching mirrors the TypeScript checker rather than a regular expression. Refined/chained schema parts, unsupported values, and a cross product over 10000 members throw during construction.

**Issue code:** `templateLiteral:expected_template_literal`

## Numeric validation

Built-in validations preserve successful values and enforce only their stated condition.

- `isFinite()` — `Number.isFinite`; issue `isFinite:expected_finite`
- `isNaN()` — `Number.isNaN`; issue `isNaN:expected_nan`
- `isInteger()` — `Number.isInteger`; issue `isInteger:expected_integer`
- `isSafeInteger()` — `Number.isSafeInteger`; issue `isSafeInteger:expected_safe_integer`
- `isAtLeast(minimum)` / `isAtMost(maximum)` — inclusive number or bigint bounds
- `isGreaterThan(minimum)` / `isLessThan(maximum)` — strict number or bigint bounds
- `isMultipleOf(divisor)` — bigint exact remainder or bounded floating-point tolerance for numbers

Bound issue codes are `isAtLeast:expected_at_least`, `isAtMost:expected_at_most`, `isGreaterThan:expected_greater_than`, and `isLessThan:expected_less_than`. `isMultipleOf()` owns `isMultipleOf:expected_multiple_of` and rejects zero or non-finite number divisors, and zero bigint divisors, during construction.

```ts
const lowerBoundResult = v.number()
	.isAtLeast(0)
	.execute(Infinity) // success
const finiteLowerBoundResult = v.number()
	.isFinite()
	.isAtLeast(0)
	.execute(Infinity) // failure
```

## Date validation

`date(options?)` accepts valid `Date` instances and rejects Invalid Date.

**Issue codes:** `date:expected_date`, `date:invalid_date`

`isAfter(bound)` and `isBefore(bound)` compare `getTime()` strictly; the bound itself is rejected. They own `isAfter:expected_after` and `isBefore:expected_before`.

## Length, emptiness, and inclusion

- `isLengthAtLeast()`, `isLengthAtMost()`, and `isLengthExactly()` check the observed `length` and include it in failure payloads.
- `isEmpty()` and `isNotEmpty()` check the observed numeric `length` or `size` once.
- `isStartingWith()` and `isEndingWith()` follow the corresponding string methods.
- `isIncluding()` uses native string, array, or Set inclusion semantics. Arrays and Sets use SameValueZero.
- `isMatching()` snapshots a `RegExp` source/flags and resets `lastIndex` for deterministic repeated calls.

Relevant issue codes follow the public name, including `isLengthAtLeast:expected_length_at_least`, `isLengthAtMost:expected_length_at_most`, `isLengthExactly:expected_length_exactly`, `isEmpty:expected_empty`, `isNotEmpty:expected_not_empty`, `isStartingWith:expected_starting_with`, `isEndingWith:expected_ending_with`, `isIncluding:expected_including`, and `isMatching:expected_matching`.

## Primitive equality and nullish narrowing

`isEqualTo(expected)` and `isOneOf(values)` accept primitive expectations and use `Object.is`; `NaN` equals `NaN`, while positive and negative zero differ. `isOneOf()` requires a non-empty tuple and snapshots its configured values. Successful output narrows to the expected literal or member union.

**Issue codes:** `isEqualTo:expected_equal_to`, `isOneOf:expected_one_of`

- `isDefined()` removes `undefined` and preserves `null`.
- `isNonNull()` removes `null` and preserves `undefined`.
- `isNonNullish()` removes both.

**Issue codes:** `isDefined:expected_defined`, `isNonNull:expected_non_null`, `isNonNullish:expected_non_nullish`

## JSON and string formats

`json(options?)` validates that a string is parseable JSON while preserving the original string. Use `toJSONValue()` for parsing.

**Issue code:** `json:invalid_json`

Dedicated value-preserving format validators include `isEmail()`, `isUrl()`, `isUuid()`, `isIp()`, `isIsoDate()`, `isIsoTime()`, `isIsoDateTime()`, `isJwt()`, `isEmoji()`, `isHex()`, `isMac()`, `isHostname()`, `isBase64()`, `isBase64Url()`, `isCuid2()`, `isUlid()`, and `isNanoid()`. See [String formats](./formats.md) for their exact contracts.

## Generic validation and messages

`check(predicate, options?)` is the generic validation escape hatch. It supports predicates, type guards, typed `addIssue()`, and direct or `PromiseLike` callback results.

```ts
const schema = v.string()
	.isLengthAtLeast(3, { message: 'Too short' })
	.check(value => value.includes('@'), { message: 'Expected @' })
```
