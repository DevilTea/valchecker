<!-- Generated file. Do not edit it: `pnpm docs:api` fails when it stops matching its sources,
and `pnpm docs:api:update` rewrites it.

Each step's entry comes from `packages/internal/src/steps/<name>/<name>.doc.md`. The prose
around them, and the order the sections appear in, come from `scripts/docs-api-templates/<page>.md`. -->

# Primitives

Primitive initial steps check JavaScript and TypeScript identities, and the validations on this page preserve the successful value while enforcing only the condition their name expresses. Message-bearing methods use a trailing options object, for example `string({ message })`, `literal(value, { message })`, and `isAtLeast(minimum, { message })`.

## Initial schemas

An initial schema opens a pipeline: it is available on the instance rather than after another step.

### `any()` {#any}

Accepts every value and performs no runtime check. The output type is `any`, which opts the rest of
the pipeline out of type checking. `unknown()` is the same runtime passthrough with an `unknown`
output type.

```ts
v.any()
	.execute('anything')
// { value: 'anything' }
```

**Issues:** none. The step performs no check, so it cannot fail.

### `bigint(options?)` {#bigint}

Checks that the value is a bigint, following `typeof value === 'bigint'`. A number is not a bigint
and fails; `looseBigint()` accepts a `${bigint}` string, and `toBigint()` converts with native
`BigInt()`.

```ts
v.bigint()
	.execute(42n)
// { value: 42n }

v.bigint()
	.execute(42) // failure
```

**Issue code:** `bigint:expected_bigint` — the value is not a bigint. Payload `{ value }`.

### `boolean(options?)` {#boolean}

Checks that the value is a boolean, following `typeof value === 'boolean'`. Nothing else is treated
as truthy or falsy: `0`, `1`, `'true'`, and `'false'` all fail. Use `looseBoolean()` for the
`"true"`/`"false"` strings, or `toMappedBoolean()` for an explicit mapping of other values.

```ts
v.boolean()
	.execute(true)
// { value: true }

v.boolean()
	.execute('true') // failure
```

**Issue code:** `boolean:expected_boolean` — the value is not a boolean. Payload `{ value }`.

### `literal(value, options?)` {#literal}

Checks that the value matches the configured literal with `Object.is`, so `NaN` matches `NaN` while
`0` and `-0` are distinct. The expected literal is a string, number, boolean, bigint, or symbol, and
the successful output narrows to that literal type.

```ts
v.literal('hello')
	.execute('hello')
// { value: 'hello' }

v.literal(42)
	.execute(43) // failure
```

**Issue code:** `literal:expected_literal` — the value does not match the expected literal. Payload
`{ value, expected }`.

### `never(options?)` {#never}

Fails for every value, including `undefined`, and has output type `never`. No value inhabits that
output type, so nothing downstream can be typed to produce a success either — even `fallback()`,
whose replacement must be assignable to the current output. The step states that a position is not
meant to validate at all.

```ts
v.never()
	.execute(42) // failure
v.never({ message: 'This field is not allowed.' })
	.execute(undefined) // failure
```

**Issue code:** `never:expected_never` — the step rejects every value it is given. Payload
`{ value }`.

### `null(options?)` {#null}

Checks that the value is exactly `null`. `undefined` fails — `undefined()` covers that value, and
`isNonNullish()` narrows away both. The plugin is exported as `null_` for selective registration,
because `null` is a reserved word; the method it registers is still `v.null()`.

```ts
v.null()
	.execute(null)
// { value: null }

v.null()
	.execute(undefined) // failure
```

**Issue code:** `null:expected_null` — the value is not `null`. Payload `{ value }`.

### `number(options?)` {#number}

Checks that the value is a JavaScript number. This matches the TypeScript `number` type, so it
accepts `NaN`, `Infinity`, and `-Infinity`: the step has no hidden finite-number policy. Compose
`isFinite()` when the application requires a finite number.

```ts
v.number()
	.execute(Number.NaN) // success
v.number()
	.execute(Number.POSITIVE_INFINITY) // success
v.number()
	.isFinite()
	.execute(Number.POSITIVE_INFINITY) // failure
```

**Issue code:** `number:expected_number` — the value is not a number. Payload `{ value }`.

### `string(options?)` {#string}

Checks that the value is a string, following `typeof value === 'string'`. The empty string succeeds:
emptiness is a separate condition, expressed by `isNotEmpty()` or `isLengthAtLeast()`.

```ts
v.string()
	.execute('hello')
// { value: 'hello' }

v.string()
	.execute('') // success
v.string()
	.isNotEmpty()
	.execute('') // failure
```

**Issue code:** `string:expected_string` — the value is not a string. Payload `{ value }`.

### `symbol(options?)` {#symbol}

Checks that the value is a symbol, following `typeof value === 'symbol'`. Both an anonymous symbol
and one with a description succeed, and the step reads nothing but the type: use `literal(symbol)`
to require one particular symbol.

```ts
v.symbol()
	.execute(Symbol('id'))
// { value: Symbol(id) }

v.symbol()
	.execute('id') // failure
```

**Issue code:** `symbol:expected_symbol` — the value is not a symbol. Payload `{ value }`.

### `undefined(options?)` {#undefined}

Checks that the value is exactly `undefined`. `null` fails — `null()` covers that value. The plugin
is exported as `undefined_` for selective registration, for the same reason `null_` is; the method
it registers is still `v.undefined()`.

```ts
v.undefined()
	.execute(undefined)
// { value: undefined }

v.undefined()
	.execute(null) // failure
```

**Issue code:** `undefined:expected_undefined` — the value is not `undefined`. Payload `{ value }`.

### `unknown()` {#unknown}

Accepts every value and performs no runtime check. The output type is `unknown`, which keeps the
value opaque until a later step narrows it — `use()`, `check()` with a type guard, or `as<T>()`.

```ts
v.unknown()
	.execute('anything')
// { value: 'anything' }
```

**Issues:** none. The step performs no check, so it cannot fail.

## Loose primitives

Loose primitives accept the primitive or its corresponding TypeScript template-literal string representation, then produce the canonical primitive. They do not perform unrestricted JavaScript coercion, and each one accepts exactly the strings its TypeScript template type describes.

Each is an initial schema rather than a coercion helper: it is available on the instance, or after an output that is exactly `unknown` or `any`. Converting an output an earlier step already produced is what `toNumber()`, `toBigint()`, and `toMappedBoolean()` are for.

### `looseBigint(options?)` {#looseBigint}

Accepts a bigint, or a string TypeScript accepts as `${bigint}`, and normalizes the output to a
bigint. The string grammar is an optional `-` sign, then either a decimal without leading zeros or a
`0x`, `0b`, or `0o` radix literal, with the prefix and hex digits in either case. There are no
numeric separators and no trailing `n`, so `'0x10'` yields `16n` and `'-0x10'` yields `-16n`, while
`'01'`, `'1.0'`, `'1e3'`, and `'1n'` are rejected.

This is not `looseNumber()`'s grammar: a leading `+` and surrounding whitespace are accepted there
and rejected here.

```ts
v.looseBigint()
	.execute('0x10') // { value: 16n }
v.looseBigint()
	.execute('-0x10') // { value: -16n }
v.looseBigint()
	.execute('01') // failure
v.looseBigint()
	.execute('1.0') // failure
```

`templateLiteral()` reads its `${bigint}` placeholders from this same grammar, so a placeholder and
this step accept exactly the same strings.

**Issue code:** `looseBigint:expected_bigint` — the value is neither a bigint nor a
TypeScript-compatible bigint string. Payload `{ value }`.

### `looseBoolean(options?)` {#looseBoolean}

Accepts a boolean, or one of the two strings TypeScript accepts as `${boolean}`, and normalizes the
output to a boolean. Loose booleans accept only `"true"` and `"false"`: no other casing, no `'1'`,
`'yes'`, or `'on'`, and no number. Use `toMappedBoolean()` when the input uses its own vocabulary.

```ts
v.looseBoolean()
	.execute('false') // { value: false }
v.looseBoolean()
	.execute('TRUE') // failure
v.looseBoolean()
	.execute(1) // failure
```

**Issue code:** `looseBoolean:expected_boolean` — the value is neither a boolean nor `"true"` or
`"false"`. Payload `{ value }`.

### `looseNumber(options?)` {#looseNumber}

Accepts a number, or a string TypeScript accepts as `${number}`, and normalizes the output to a
number. A number passes through unchanged, including `NaN`, `Infinity`, and `-Infinity` — the step
has no more finite-number policy than `number()` does.

The string grammar is TypeScript's, not `Number()`'s: it is `Number.isFinite(+string)` on a
non-empty string. So `'+1'`, `'.5'`, `'5.'`, `'1e3'`, and `'0x10'` are accepted, and in accordance
with TypeScript's `${number}` behavior a non-empty whitespace-only string is accepted and normalizes
to `0` while the empty string is rejected. `'NaN'`, `'Infinity'`, `'1_000'`, and `'1e999'` are
rejected even though the corresponding numbers, where they exist, are valid inputs.

```ts
v.looseNumber()
	.execute('42') // { value: 42 }
v.looseNumber()
	.execute('   ') // { value: 0 }
v.looseNumber()
	.execute('') // failure
v.looseNumber()
	.execute('Infinity') // failure
v.looseNumber()
	.execute(Number.POSITIVE_INFINITY) // success
```

`templateLiteral()` reads its `${number}` placeholders from this same grammar, so a placeholder and
this step accept exactly the same strings.

**Issue code:** `looseNumber:expected_number` — the value is neither a number nor a
TypeScript-compatible number string. Payload `{ value }`.

## Template literals

### `templateLiteral(parts, options?)` {#templateLiteral}

Validates a string against an assembled TypeScript template-literal type and infers that exact
output type. Each part is either an interpolatable literal
(`string | number | bigint | boolean | null | undefined`) or a bare interpolatable initial schema —
`string()`, `number()`, `bigint()`, `boolean()`, `literal()`, `null()`, `undefined()`, `union()`, or
a nested `templateLiteral()`. Union parts expand into a cross-product union.

```ts
v.templateLiteral(['ID-', v.number()]) // output `ID-${number}`
v.templateLiteral([v.number(), v.union(['px', 'em'])])
// output `${number}px` | `${number}em`
```

Matching mirrors the TypeScript checker's placeholder split rule rather than a regular expression:
the leftmost delimiter wins, adjacent placeholders capture exactly one character, and there is no
backtracking. `${number}` and `${bigint}` placeholders use the grammars `looseNumber()` and
`looseBigint()` own, so a placeholder and the corresponding schema accept exactly the same strings.

```ts
v.templateLiteral([v.string(), 'x', v.number()])
	.execute('axbx1') // failure: the leftmost `x` leaves `bx1` for the number slot
v.templateLiteral([v.string(), v.number()])
	.execute('abc1') // failure: an adjacent string slot captures a single character
v.templateLiteral([v.string(), v.string()])
	.execute('anything') // success: an all-string template reduces to `string`
```

It is an initial schema, so it is unavailable after a step that already produced a concrete output.

Construction throws a `TypeError` instead of deferring the problem to execution: for a `parts`
argument that is not an array, a symbol part, a non-finite number part, a value that is not
interpolatable, a schema part carrying no template-literal representation — which includes a refined
or chained schema such as `v.string().toTrimmed()`, because a further step drops the construction
metadata the part is recognized by — and a cross product over 10000 members.

**Issue code:** `templateLiteral:expected_template_literal` — the value is not a string, or is a
string that does not match the assembled template. Payload `{ value, template }`, where `template`
is the canonical rendering of the whole template, for example `` `${"a" | "b"}-${1 | 2}` ``.

## Numeric validation

### `isAtLeast(minimum, options?)` {#isAtLeast}

Checks that a number or bigint is greater than or equal to `minimum`, with the native `>=`
comparison, so the bound itself is accepted. The operand follows the current output: a `number`
schema takes a `number` minimum, a `bigint` schema takes a `bigint` one.

The step carries no finite-number policy, so `isAtLeast(0)` accepts positive infinity. Compose
`isFinite()` when both constraints are required.

```ts
v.number()
	.isAtLeast(0)
	.execute(Number.POSITIVE_INFINITY) // success
v.number()
	.isFinite()
	.isAtLeast(0)
	.execute(Number.POSITIVE_INFINITY) // failure

v.bigint()
	.isAtLeast(10n)
	.execute(10n)
// { value: 10n }
```

**Issue code:** `isAtLeast:expected_at_least` — the value is below the minimum. Payload
`{ target, value, minimum }`, where `target` is `'number'` or `'bigint'`.

### `isAtMost(maximum, options?)` {#isAtMost}

Checks that a number or bigint is less than or equal to `maximum`, with the native `<=` comparison,
so the bound itself is accepted. The operand follows the current output: a `number` schema takes a
`number` maximum, a `bigint` schema takes a `bigint` one.

```ts
v.number()
	.isAtMost(100)
	.execute(100)
// { value: 100 }

v.bigint()
	.isAtMost(10n)
	.execute(15n)
// failure
```

**Issue code:** `isAtMost:expected_at_most` — the value exceeds the maximum. Payload
`{ target, value, maximum }`, where `target` is `'number'` or `'bigint'`.

### `isFinite(options?)` {#isFinite}

Checks that the number is finite, delegating to `Number.isFinite`. `NaN`, `Infinity`, and
`-Infinity` therefore fail. This is the step that adds a finite-number policy `number()` and the
bound validations deliberately leave out.

```ts
v.number()
	.isFinite()
	.execute(42)
// { value: 42 }

v.number()
	.isFinite()
	.execute(Number.NaN)
// failure
```

**Issue code:** `isFinite:expected_finite` — the number is `NaN`, `Infinity`, or `-Infinity`.
Payload `{ value }`.

### `isGreaterThan(minimum, options?)` {#isGreaterThan}

Checks that a number or bigint is strictly greater than the configured bound, with the native `>`
comparison, so the bound itself is rejected. The operand follows the current output: a `number`
schema takes a `number` bound, a `bigint` schema takes a `bigint` one. `Number.NaN` never satisfies
the comparison, and the step adds no policy of its own for it.

`isGreaterThan(0)` accepts positive infinity; use `isFinite().isGreaterThan(0)` when both
constraints are required.

```ts
v.number()
	.isGreaterThan(1)
	.execute(1)
// failure

v.bigint()
	.isGreaterThan(1n)
	.execute(2n)
// { value: 2n }
```

**Issue code:** `isGreaterThan:expected_greater_than` — the value is not greater than the bound.
Payload `{ target, value, minimum }`, where `target` is `'number'` or `'bigint'`.

### `isInteger(options?)` {#isInteger}

Checks that the number is an integer, delegating to `Number.isInteger`. A fractional value, `NaN`,
and the infinities fail; the check places no bound on magnitude, so an integer beyond the safe
range still passes. Use `isSafeInteger()` for that narrower contract.

```ts
v.number()
	.isInteger()
	.execute(42)
// { value: 42 }

v.number()
	.isInteger()
	.execute(1.5)
// failure
```

**Issue code:** `isInteger:expected_integer` — the value is not an integer. Payload `{ value }`.

### `isLessThan(maximum, options?)` {#isLessThan}

Checks that a number or bigint is strictly less than the configured bound, with the native `<`
comparison, so the bound itself is rejected. The operand follows the current output: a `number`
schema takes a `number` bound, a `bigint` schema takes a `bigint` one. `Number.NaN` never satisfies
the comparison, and the step adds no policy of its own for it.

```ts
v.number()
	.isLessThan(2)
	.execute(2)
// failure

v.bigint()
	.isLessThan(2n)
	.execute(1n)
// { value: 1n }
```

**Issue code:** `isLessThan:expected_less_than` — the value is not less than the bound. Payload
`{ target, value, maximum }`, where `target` is `'number'` or `'bigint'`.

### `isMultipleOf(divisor, options?)` {#isMultipleOf}

Checks that a number or bigint is a multiple of `divisor`. Bigint inputs use an exact remainder
check. Number inputs accept an exact zero remainder. Otherwise they reconstruct the nearest integer
multiple as `Math.round(value / divisor) * divisor` and compare it with `value` using a tolerance of
`Number.EPSILON * Math.max(1, Math.abs(value), Math.abs(reconstructed)) * 8`. This scales with the
IEEE-754 magnitude being compared, so ordinary decimal expressions such as `0.3`, `0.1 + 0.2`, and
larger-quotient decimal multiples are not rejected by an arbitrary absolute cap. It is still a
floating-point representation tolerance, not an arbitrary-precision decimal or general nearness
check. A non-finite input, or a non-finite quotient/reconstruction on the inexact path, fails.

A zero or non-finite number divisor, and a zero bigint divisor, make divisibility meaningless and
throw a `TypeError` while the schema is being constructed. That guard is deliberately asymmetric
with the bound validations, which accept any operand because their naming contract forbids hidden
operand policy.

```ts
v.number()
	.isMultipleOf(0.1)
	.execute(0.1 + 0.2)
// { value: 0.30000000000000004 }

v.bigint()
	.isMultipleOf(3n)
	.execute(9n)
// { value: 9n }

v.number()
	.isMultipleOf(2)
	.execute(Number.POSITIVE_INFINITY)
// failure

v.number()
	.isMultipleOf(0) // throws a TypeError while constructing the schema
```

**Issue code:** `isMultipleOf:expected_multiple_of` — the value is not a multiple of the divisor.
Payload `{ target, value, divisor }`, where `target` is `'number'` or `'bigint'`.

### `isNaN(options?)` {#isNaN}

Checks that the number is `NaN`, delegating to `Number.isNaN`. Every other number fails, including
`Infinity` and `-Infinity`.

```ts
v.number()
	.isNaN()
	.execute(Number.NaN)
// { value: NaN }

v.number()
	.isNaN()
	.execute(0)
// failure
```

**Issue code:** `isNaN:expected_nan` — the number is not `NaN`. Payload `{ value }`.

### `isSafeInteger(options?)` {#isSafeInteger}

Checks that the number is a safe integer, delegating to `Number.isSafeInteger`. It accepts
`Number.MAX_SAFE_INTEGER` and rejects anything above it, along with fractional values, `NaN`, and
the infinities.

```ts
v.number()
	.isSafeInteger()
	.execute(Number.MAX_SAFE_INTEGER)
// { value: 9007199254740991 }

v.number()
	.isSafeInteger()
	.execute(Number.MAX_SAFE_INTEGER + 1)
// failure
```

**Issue code:** `isSafeInteger:expected_safe_integer` — the value is not a safe integer. Payload
`{ value }`.

## Date validation

### `date(options?)` {#date}

Checks that the value is a `Date` instance and rejects an Invalid Date, and infers a `Date` output.
Like the other initial schemas it opens a pipeline: it is available on the instance, or after an
output that is exactly `unknown` or `any`.

Unlike `instance(Date)` it also rejects an Invalid Date, and it emits its own `date:*` issues rather
than `instance:expected_instance`.

```ts
v.date()
	.execute(new Date('2020-01-01T00:00:00.000Z'))
// success

v.date()
	.execute(new Date('nope'))
// failure
```

**Issues:**

- `date:expected_date` — the value is not a `Date` instance. Payload `{ value }`.
- `date:invalid_date` — the value is a `Date` whose `getTime()` is `NaN`, such as
  `new Date('nope')`. Payload `{ value }`, carrying that `Date`.

### `isAfter(bound, options?)` {#isAfter}

Checks that a `Date` is strictly after `bound`, a `Date`, comparing `getTime()` values. The bound
itself is rejected. Only the strict variant exists; pass an adjusted bound when an inclusive edge is
required.

The bound's comparison value and diagnostic representation are snapshotted when the schema is
constructed. Mutating the caller-owned `Date` afterward does not change validation or failure
diagnostics.

An Invalid Date bound is not rejected at construction: every value then fails with this step's own
issue, and the default message renders the bound as `Invalid Date`.

```ts
v.date()
	.isAfter(new Date('2020-01-01T00:00:00.000Z'))
	.execute(new Date('2020-01-02T00:00:00.000Z'))
// success

v.date()
	.isAfter(new Date('2020-01-01T00:00:00.000Z'))
	.execute(new Date('2020-01-01T00:00:00.000Z'))
// failure
```

**Issue code:** `isAfter:expected_after` — the value is not after the bound. Payload
`{ value, bound }`.

### `isBefore(bound, options?)` {#isBefore}

Checks that a `Date` is strictly before `bound`, a `Date`, comparing `getTime()` values. The bound
itself is rejected. Only the strict variant exists; pass an adjusted bound when an inclusive edge is
required.

The bound's comparison value and diagnostic representation are snapshotted when the schema is
constructed. Mutating the caller-owned `Date` afterward does not change validation or failure
diagnostics.

An Invalid Date bound is not rejected at construction: every value then fails with this step's own
issue, and the default message renders the bound as `Invalid Date`.

```ts
v.date()
	.isBefore(new Date('2020-01-02T00:00:00.000Z'))
	.execute(new Date('2020-01-01T00:00:00.000Z'))
// success

v.date()
	.isBefore(new Date('2020-01-02T00:00:00.000Z'))
	.execute(new Date('2020-01-02T00:00:00.000Z'))
// failure
```

**Issue code:** `isBefore:expected_before` — the value is not before the bound. Payload
`{ value, bound }`.

## Length, emptiness, and inclusion

These validations read a value's own `length` — or its `size`, where the value is a collection — or use the corresponding native string, array, or Set operation. `isEmpty()`, `isNotEmpty()`, and `isIncluding()` are here rather than on [Structures](/api/structures) because they read a string or an array as readily as a Map or a Set; the dedicated `size` bounds are [there](/api/structures#isSizeAtLeast).

### `isEmpty(options?)` {#isEmpty}

Checks that the observed `length` or `size` equals zero, so it is available after a string or an
array through `length`, and after a Map or a Set through `size`. The runtime probes `length` first
and falls back to `size` only when `length` is not a number, and it reads whichever property it uses
exactly once — the number that is compared is the number the failure payload reports, even for a
getter that would answer differently on a second read.

```ts
v.string()
	.isEmpty()
	.execute('')
// { value: '' }

v.set(v.string())
	.isEmpty()
	.execute(new Set(['x']))
// failure, payload { value: Set { 'x' }, size: 1 }
```

**Issue code:** `isEmpty:expected_empty` — the observed `length` or `size` is not zero. The
payload is `{ value, length }` for a length-bearing value and `{ value, size }` for a size-bearing
one.

### `isEndingWith(suffix, options?)` {#isEndingWith}

Checks that the string ends with the suffix, following the native `String.prototype.endsWith`. It
adds no policy of its own: the empty suffix matches every string, and the comparison is the method's
plain code-unit comparison, with no case folding or Unicode normalization.

```ts
v.string()
	.isEndingWith('.txt')
	.execute('file.txt')
// { value: 'file.txt' }
```

**Issue code:** `isEndingWith:expected_ending_with` — the string does not end with the suffix.
Payload `{ value, suffix }`.

### `isIncluding(value, options?)` {#isIncluding}

Checks that a string, an array, or a Set includes the value, using the native operation for
whichever of the three the current output is: `String.prototype.includes` for a string,
`Array.prototype.includes` for an array, and `Set.prototype.has` for a Set. A string search is
therefore a substring test, while arrays and Sets compare with SameValueZero, so `NaN` matches
`NaN` and `0` matches `-0`.

The options object carries the one option the matching native call accepts alongside `message`:
`position` for a string, the index the substring search starts from, and `fromIndex` for an array.
A Map is not accepted, because it has no unambiguous membership domain — use `isIncludingKey()` or
`isIncludingValue()`, on [Structures](/api/structures), which name the searched domain explicitly.

```ts
v.string()
	.isIncluding('lo')
	.execute('hello')
// { value: 'hello' }

v.array(v.number())
	.isIncluding(Number.NaN)
	.execute([1, Number.NaN])
// { value: [1, NaN] }

v.set(v.string())
	.isIncluding('required', { message: 'The "required" tag is mandatory.' })
```

**Issue code:** `isIncluding:expected_including` — the value is not included. The payload names
the searched value `expected` for every variant and discriminates on `target`, so it is one of
`{ target: 'string', value, expected, position }`,
`{ target: 'array', value, expected, fromIndex }`, and `{ target: 'set', value, expected }`.

### `isLengthAtLeast(minimum, options?)` {#isLengthAtLeast}

Checks that the value's own `length` is greater than or equal to the minimum; the bound is
inclusive. The runtime reads `length` once and snapshots it in the failure payload, so the length
that was compared is the length that is reported. It is available after any output that exposes a
numeric `length`, which includes strings and arrays.

```ts
v.string()
	.isLengthAtLeast(3)
	.execute('hello')
// { value: 'hello' }

v.string()
	.isLengthAtLeast(3)
	.execute('hi')
// failure, payload { value: 'hi', minimumLength: 3, length: 2 }
```

**Issue code:** `isLengthAtLeast:expected_length_at_least` — the observed length is below the
minimum. Payload `{ value, minimumLength, length }`.

### `isLengthAtMost(maximum, options?)` {#isLengthAtMost}

Checks that the value's own `length` is less than or equal to the maximum; the bound is inclusive.
The runtime reads `length` once and snapshots it in the failure payload, so the length that was
compared is the length that is reported. It is available after any output that exposes a numeric
`length`, which includes strings and arrays.

```ts
v.string()
	.isLengthAtLeast(3)
	.isLengthAtMost(20)
	.execute('hello')
// { value: 'hello' }

v.string()
	.isLengthAtMost(3)
	.execute('hello')
// failure, payload { value: 'hello', maximumLength: 3, length: 5 }
```

**Issue code:** `isLengthAtMost:expected_length_at_most` — the observed length exceeds the
maximum. Payload `{ value, maximumLength, length }`.

### `isLengthExactly(expectedLength, options?)` {#isLengthExactly}

Checks that the value's own `length` equals the expected length. The runtime reads `length` once and
snapshots it in the failure payload, so the length that was compared is the length that is reported.
It is available after any output that exposes a numeric `length`, which includes strings and arrays.

```ts
v.string()
	.isLengthExactly(8)
	.execute('password')
// { value: 'password' }

v.array(v.number())
	.isLengthExactly(2)
	.execute([1])
// failure, payload { value: [1], expectedLength: 2, length: 1 }
```

**Issue code:** `isLengthExactly:expected_length_exactly` — the observed length is not exactly the
expected length. Payload `{ value, expectedLength, length }`.

### `isMatching(pattern, options?)` {#isMatching}

Checks that the string matches the regular expression. The pattern is snapshotted while the schema
is constructed: its `source` and `flags` are copied into a schema-time snapshot, and the schema tests
against a fresh `RegExp` built from that snapshot. Before and after each test `lastIndex` is reset
to `0`. Both together make repeated executions deterministic — a stateful `g` or `y` pattern
cannot carry a match position from one execution into the next, and mutating the caller's `RegExp`
afterwards cannot change what the schema tests. A non-`RegExp` pattern throws a `TypeError` while
the schema is constructed.

```ts
v.string()
	.isMatching(/^\d+$/)
	.execute('123')
// { value: '123' }

v.string()
	.isMatching(/^foo$/i, { message: 'Expected foo.' })
	.execute('bar')
// failure
```

**Issue code:** `isMatching:expected_matching` — the string does not match the pattern. Payload
`{ value, pattern }`, where `pattern` is the `{ source, flags }` construction snapshot rather than the
`RegExp` itself.

### `isNotEmpty(options?)` {#isNotEmpty}

Checks that the observed `length` or `size` is greater than zero, so it is available after a string
or an array through `length`, and after a Map or a Set through `size`. As in `isEmpty()`, the
runtime probes `length` first and falls back to `size` only when `length` is not a number, and it
reads whichever property it uses exactly once — the number that is compared is the number the
failure payload reports.

```ts
v.string()
	.isNotEmpty()
	.execute('value')
// { value: 'value' }

v.map({ key: v.string(), value: v.number() })
	.isNotEmpty()
	.execute(new Map())
// failure, payload { value: Map {}, size: 0 }
```

**Issue code:** `isNotEmpty:expected_not_empty` — the observed `length` or `size` is zero. The
payload is `{ value, length }` for a length-bearing value and `{ value, size }` for a size-bearing
one.

### `isStartingWith(prefix, options?)` {#isStartingWith}

Checks that the string starts with the prefix, following the native `String.prototype.startsWith`.
It adds no policy of its own: the empty prefix matches every string, and the comparison is the
method's plain code-unit comparison, with no case folding or Unicode normalization.

```ts
v.string()
	.isStartingWith('hello')
	.execute('hello world')
// { value: 'hello world' }
```

**Issue code:** `isStartingWith:expected_starting_with` — the string does not start with the
prefix. Payload `{ value, prefix }`.

## Equality and nullish narrowing

### `isDefined(options?)` {#isDefined}

Checks that the value is not `undefined`, and narrows the output by removing `undefined`. A `null`
value passes and is preserved — that is the whole difference between the three nullish narrowings:
`isDefined()` removes `undefined`, `isNonNull()` removes `null`, and `isNonNullish()` removes both.

The method is offered only when the current output can actually be `undefined`, so
`v.string().isDefined()` does not exist. After an `unknown` output it narrows to
`NonNullable<unknown> | null`.

```ts
v.union([v.string(), v.null(), v.undefined()])
	.isDefined()
	.execute(null)
// { value: null }, output `string | null`
```

**Issue code:** `isDefined:expected_defined` — the value is `undefined`. Payload `{ value }`,
whose `value` is always `undefined`.

### `isEqualTo(expected, options?)` {#isEqualTo}

Checks that the value equals the expected primitive. Only a primitive expectation is accepted — a
`bigint`, `boolean`, `null`, `number`, `string`, `symbol`, or `undefined`; an object expectation is
rejected by the type rather than compared structurally. The comparison is `Object.is`, so `NaN`
equals `NaN` while positive and negative zero differ.

Successful output narrows to the expected literal, which is part of the public contract: after
`v.union([v.string(), v.number()]).isEqualTo('ready')` the output is `'ready'`. The method is
unavailable in the initial state, and for an output with no primitive member such as an object-only
output.

```ts
v.number()
	.isEqualTo(Number.NaN)
	.execute(Number.NaN)
// { value: NaN }

v.number()
	.isEqualTo(-0)
	.execute(0)
// failure

v.union([v.string(), v.number()])
	.isEqualTo('ready')
	.execute('ready')
// { value: 'ready' }, output `'ready'`
```

**Issue code:** `isEqualTo:expected_equal_to` — the value is not equal to the expected value.
Payload `{ value, expected }`.

### `isNonNull(options?)` {#isNonNull}

Checks that the value is not `null`, and narrows the output by removing `null`. An `undefined` value
passes and is preserved — that is the whole difference between the three nullish narrowings:
`isNonNull()` removes `null`, `isDefined()` removes `undefined`, and `isNonNullish()` removes both.

The method is offered only when the current output can actually be `null`, so
`v.string().isNonNull()` does not exist. After an `unknown` output it narrows to
`NonNullable<unknown> | undefined`.

```ts
v.union([v.string(), v.null(), v.undefined()])
	.isNonNull()
	.execute(undefined)
// { value: undefined }, output `string | undefined`
```

**Issue code:** `isNonNull:expected_non_null` — the value is `null`. Payload `{ value }`, whose
`value` is always `null`.

### `isNonNullish(options?)` {#isNonNullish}

Checks that the value is neither `null` nor `undefined`, and narrows the output by removing both.
That is the whole difference between the three nullish narrowings: `isNonNullish()` removes both,
while `isDefined()` removes only `undefined` and `isNonNull()` removes only `null`.

The method is offered only when the current output can actually be nullish, so
`v.string().isNonNullish()` does not exist. After an `unknown` output it narrows to
`NonNullable<unknown>`.

```ts
v.union([v.string(), v.null(), v.undefined()])
	.isNonNullish()
	.execute('value')
// { value: 'value' }, output `string`
```

**Issue code:** `isNonNullish:expected_non_nullish` — the value is `null` or `undefined`. Payload
`{ value }`, whose `value` is the nullish value that was observed.

### `isOneOf(values, options?)` {#isOneOf}

Checks that the value is one of the configured primitives, comparing each candidate with
`Object.is`, so `NaN` equals `NaN` while positive and negative zero differ. As with `isEqualTo()`,
only primitive candidates are accepted, and the method is unavailable in the initial state and for
an output with no primitive member.

A non-empty tuple is required: an empty array is rejected by the type, and a JavaScript caller
passing one gets a `TypeError` while the schema is constructed. The configured values are
snapshotted into an owned array at construction, so mutating the caller's array afterwards does not
change what the schema accepts, and the failure payload exposes that same construction snapshot.
Successful output narrows to the union of the members, which is part of the public contract. The
step also advertises its candidates as a finite member set, which is what lets `record()` treat such
a key schema's domain as closed and exhaustive — see [Structures](/api/structures).

```ts
v.string()
	.isOneOf(['red', 'green', 'blue'])
	.execute('red')
// { value: 'red' }, output `'red' | 'green' | 'blue'`

v.string()
	.isOneOf(['a', 'b'], { message: 'Allowed value required' })
	.execute('c')
// failure, payload { value: 'c', expectedValues: ['a', 'b'] }
```

**Issue code:** `isOneOf:expected_one_of` — the value did not match any candidate. Payload
`{ value, expectedValues }`.

## JSON strings

### `json(options?)` {#json}

Checks that the current string is parseable JSON while preserving the string: the output stays the
original text, not the parsed value. It parses with `JSON.parse` and discards the result, so any
top-level JSON value — object, array, string, number, boolean, or `null` — is accepted, and the
empty string is not. Use `toJSONValue()` when the parsed value is what the pipeline needs.

```ts
v.string()
	.json()
	.execute('{"name":"John"}')
// { value: '{"name":"John"}' }

v.string()
	.json()
	.execute('{invalid}')
// failure
```

**Issue code:** `json:invalid_json` — `JSON.parse` threw on the string. Payload
`{ value, error }`, where `error` is the thrown value.

## Related pages

- The dedicated string-format validators — `isEmail()`, `isUrl()`, `isUuid()` and the rest — are on [String formats](/api/formats).
- `check()`, the generic validation escape hatch for a condition no built-in expresses, is on [Helpers & Utilities](/api/helpers#check).
