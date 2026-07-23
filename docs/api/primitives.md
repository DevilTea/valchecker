# Primitives

Primitive initial steps check JavaScript and TypeScript primitive identities. Every returned schema participates in Valchecker's state-aware chaining API.

All message-bearing methods use a trailing options object. For example, write `string({ message })`, `literal(value, { message })`, and `isAtLeast(minimum, { message })`.

## Primitive initial schemas

### `string(options?)`

Validates a JavaScript string.

**Issue code:** `string:expected_string`

Common next steps include length checks, `isIncluding()`, `isMatching()`, `isEqualTo()`, `isOneOf()`, and string transformations.

### `number(options?)`

Validates the TypeScript `number` primitive by checking `typeof value === 'number'`.

**Issue code:** `number:expected_number`

`number()` deliberately accepts `NaN`, `Infinity`, and `-Infinity`. Use explicit steps such as `isFinite()`, `isInteger()`, or `isSafeInteger()` for narrower domains.

```ts
const quantity = v.number()
	.isFinite()
	.isGreaterThan(0)
	.isSafeInteger()
```

### `boolean(options?)`

Validates a JavaScript boolean.

**Issue code:** `boolean:expected_boolean`

### `bigint(options?)`

Validates a JavaScript bigint.

**Issue code:** `bigint:expected_bigint`

### `symbol(options?)`

Validates a JavaScript symbol.

**Issue code:** `symbol:expected_symbol`

### `literal(value, options?)`

Matches one literal with `Object.is` semantics. `NaN` matches `NaN`, while positive and negative zero are distinct.

**Issue code:** `literal:expected_literal`

### `unknown()` and `any()`

Both accept any runtime value without validation:

- `unknown()` outputs `unknown`.
- `any()` outputs `any`.

Use `unknown()` as the safer starting point for narrowing, `use()`, `check()`, or transformations.

### `never(options?)`

Always fails.

**Issue code:** `never:unexpected_value`

### `null(options?)` and `undefined(options?)`

Accept only `null` or `undefined` respectively.

**Issue codes:** `null:expected_null`, `undefined:expected_undefined`

## Loose primitives

Loose primitives accept the primitive or its matching TypeScript template-literal string representation, then normalize successful output to the primitive. They do not implement unrestricted JavaScript coercion.

### `looseNumber(options?)`

Input: `number | `${number}``  
Output: `number`

**Issue code:** `looseNumber:expected_number`

Numeric inputs still include `NaN` and infinity. String inputs must represent finite values compatible with TypeScript's template-literal number type. A non-empty whitespace-only string normalizes to `0`; the empty string is invalid.

### `looseBoolean(options?)`

Input: `boolean | `${boolean}``  
Output: `boolean`

Only the exact strings `"true"` and `"false"` are accepted.

**Issue code:** `looseBoolean:expected_boolean`

### `looseBigint(options?)`

Input: `bigint | `${bigint}``  
Output: `bigint`

**Issue code:** `looseBigint:expected_bigint`

## Numeric validation

Built-in validation methods preserve the successful value.

### `isFinite(options?)`, `isNaN(options?)`, and `isInteger(options?)`

Follow `Number.isFinite`, `Number.isNaN`, and `Number.isInteger`.

**Issue codes:** `isFinite:expected_finite`, `isNaN:expected_nan`, `isInteger:expected_integer`

### `isSafeInteger(options?)`

Follows `Number.isSafeInteger`.

**Issue code:** `isSafeInteger:expected_safe_integer`

### Inclusive and strict bounds

- `isAtLeast(minimum, options?)` checks `value >= minimum`.
- `isAtMost(maximum, options?)` checks `value <= maximum`.
- `isGreaterThan(minimum, options?)` checks `value > minimum`.
- `isLessThan(maximum, options?)` checks `value < maximum`.

These steps apply to numbers or bigints and do not add a hidden finite-number requirement.

**Issue codes:** `isAtLeast:expected_at_least`, `isAtMost:expected_at_most`, `isGreaterThan:expected_greater_than`, `isLessThan:expected_less_than`

```ts
v.number()
	.isGreaterThan(0)
	.execute(Infinity) // success

v.number()
	.isFinite()
	.isGreaterThan(0)
	.execute(Infinity) // failure
```

### `isMultipleOf(divisor, options?)`

Checks bigint divisibility with exact remainder semantics. Number inputs first accept an exact zero remainder, then compare the quotient with its nearest integer using a small relative tolerance capped by an absolute maximum. This accepts ordinary floating-point decimal noise without allowing tolerance to grow unbounded for huge values.

```ts
v.number()
	.isMultipleOf(0.1)
	.execute(0.1 + 0.2) // success
```

Non-finite number inputs fail. A zero divisor, non-finite number divisor, or zero bigint divisor is rejected while constructing the schema.

**Issue code:** `isMultipleOf:expected_multiple_of`

## Length validation

### `isLengthAtLeast(minimum, options?)` and `isLengthAtMost(maximum, options?)`

Check inclusive length bounds. Failure payloads include the single observed runtime `length`.

**Issue codes:** `isLengthAtLeast:expected_length_at_least`, `isLengthAtMost:expected_length_at_most`

### `isLengthExactly(expectedLength, options?)`

Checks one observed `length` read for exact equality.

**Issue code:** `isLengthExactly:expected_length_exactly`

Failure payload: `{ value, expectedLength, length }`.

### `isEmpty(options?)` and `isNotEmpty(options?)`

Check `length === 0` and `length > 0`.

**Issue codes:** `isEmpty:expected_empty`, `isNotEmpty:expected_not_empty`

## String and collection validation

### `isStartingWith(prefix, options?)` and `isEndingWith(suffix, options?)`

Follow the corresponding string methods.

**Issue codes:** `isStartingWith:expected_starting_with`, `isEndingWith:expected_ending_with`

### `isIncluding(value, options?)`

For strings, checks `String.prototype.includes` and accepts optional `position`. For arrays, checks `Array.prototype.includes` and accepts optional `fromIndex`.

Array inclusion uses SameValueZero semantics, so `NaN` can match `NaN` and positive zero matches negative zero.

**Issue code:** `isIncluding:expected_including`

The issue payload includes `target: 'string' | 'array' | 'set'` and the applicable configured and observed values.

### `isMatching(pattern, options?)`

Snapshots a `RegExp` source and flags when the schema is constructed. Each execution resets `lastIndex` before and after matching, so global and sticky expressions remain deterministic across repeated calls.

A non-`RegExp` value supplied by a JavaScript caller is rejected while constructing the schema.

**Issue code:** `isMatching:expected_matching`

## Primitive equality and narrowing

### `isEqualTo(expected, options?)`

Available after every primitive initial schema, primitive-capable unions, `unknown()`, and `any()`. It is unavailable on the initial builder and on object-only output.

The expected value must be a primitive: string, number, bigint, boolean, symbol, null, or undefined. Runtime comparison uses `Object.is`, and the successful output narrows to the configured value.

**Issue code:** `isEqualTo:expected_equal_to`

### `isOneOf(values, options?)`

Checks a non-empty readonly tuple of primitive values with `Object.is` semantics. The tuple is copied and frozen when the schema is constructed, and the successful output narrows to the tuple member union.

**Issue code:** `isOneOf:expected_one_of`

```ts
const status = v.unknown()
	.isOneOf(['draft', 'published'] as const)
// output: 'draft' | 'published'
```

### Nullish narrowing

- `isDefined(options?)` removes `undefined` and preserves `null`.
- `isNonNull(options?)` removes `null` and preserves `undefined`.
- `isNonNullish(options?)` removes both.

Each method is hidden once its excluded value is no longer possible. On `unknown()` or `any()`, the resulting output reflects the runtime exclusion instead of remaining wholly unknown.

**Issue codes:** `isDefined:expected_defined`, `isNonNull:expected_non_null`, `isNonNullish:expected_non_nullish`

## Generic validation

`check(predicate, options?)` remains the generic validation escape hatch. It supports predicates, type guards, typed `addIssue()`, synchronous callbacks, and `PromiseLike` callbacks.

## Custom messages

Every issue-producing step accepts a static message or typed message handler in its options object:

```ts
const schema = v.string()
	.isLengthAtLeast(3, { message: 'Too short' })
	.isLengthAtMost(20, { message: 'Too long' })
	.isStartingWith('http', {
		message: ({ payload }) =>
			`Expected ${payload.value} to start with ${payload.prefix}`,
	})
```