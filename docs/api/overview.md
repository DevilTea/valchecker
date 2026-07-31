<!-- Generated file. Do not edit it: `pnpm docs:api` fails when it stops matching its sources,
and `pnpm docs:api:update` rewrites it.

Each step's entry comes from `packages/internal/src/steps/<name>/<name>.doc.md`. The prose
around them, and the order the sections appear in, come from `scripts/docs-api-templates/<page>.md`. -->

# API Overview

This reference summarizes Valchecker's public schema API. The normative compatibility and semantic definition is the [Valchecker 1.0 Contract](/guide/v1-contract).

<!-- typecheck-prelude
declare const input: unknown
declare const schema: ReturnType<typeof import('valchecker').v.string>
-->

## Import strategies

### Default instance

```ts
import { v } from 'valchecker'
```

The default instance contains every built-in step.

### Custom instance with all steps

<!-- typecheck-isolate -->
```ts
import { allSteps, createValchecker } from 'valchecker'

const v = createValchecker({ steps: allSteps })
```

### Selective imports

<!-- typecheck-isolate -->
```ts
import { createValchecker, isFinite, number } from 'valchecker'

const v = createValchecker({
	steps: [number, isFinite],
})
```

## Naming convention

- Initial steps use nouns: `string()`, `number()`, `object()`, `looseBoolean()`.
- Built-in validation steps use `isXxx()`: `isInteger()`, `isStartingWith()`, `isLengthAtLeast()`.
- Concrete transformation steps use `toXxx()`: `toTrimmed()`, `toNumber()`, `toJSONValue()`.
- Generic high-level steps retain `check()` and `transform()`.
- Flow-control and type-level utilities use their most direct names.

Message-bearing steps place their message and optional configuration in a trailing options object. A single required semantic operand remains positional. For example, use `isAtLeast(0, { message })`, `isFinite({ message })`, and `toFiltered(predicate, { thisArg, message })`.

## Primitives

Every built-in step, linked to its entry on [Primitives](/api/primitives).

### Initial schemas

- [`any()`](/api/primitives#any) — passthrough typed as `any`
- [`bigint()`](/api/primitives#bigint) — `typeof value === 'bigint'`
- [`boolean()`](/api/primitives#boolean) — `typeof value === 'boolean'`
- [`literal()`](/api/primitives#literal) — exact literal match with `Object.is`
- [`never()`](/api/primitives#never) — never succeeds
- [`null()`](/api/primitives#null) — the value `null`
- [`number()`](/api/primitives#number) — every JavaScript number, including `NaN` and the infinities
- [`string()`](/api/primitives#string) — `typeof value === 'string'`
- [`symbol()`](/api/primitives#symbol) — `typeof value === 'symbol'`
- [`undefined()`](/api/primitives#undefined) — the value `undefined`
- [`unknown()`](/api/primitives#unknown) — passthrough typed as `unknown`

### Loose primitives

- [`looseBigint()`](/api/primitives#looseBigint) — a `bigint` or a `${bigint}` string, normalized to `bigint`
- [`looseBoolean()`](/api/primitives#looseBoolean) — a `boolean` or `"true"`/`"false"`, normalized to `boolean`
- [`looseNumber()`](/api/primitives#looseNumber) — a `number` or a `${number}` string, normalized to `number`

### Template literals

- [`templateLiteral()`](/api/primitives#templateLiteral) — an assembled TypeScript template-literal type, matched as the checker matches it

### Numeric validation

- [`isAtLeast()`](/api/primitives#isAtLeast) — inclusive lower bound on a number or bigint
- [`isAtMost()`](/api/primitives#isAtMost) — inclusive upper bound on a number or bigint
- [`isFinite()`](/api/primitives#isFinite) — finite numbers, through `Number.isFinite`
- [`isGreaterThan()`](/api/primitives#isGreaterThan) — strict lower bound on a number or bigint
- [`isInteger()`](/api/primitives#isInteger) — integers, through `Number.isInteger`
- [`isLessThan()`](/api/primitives#isLessThan) — strict upper bound on a number or bigint
- [`isMultipleOf()`](/api/primitives#isMultipleOf) — divisibility by a number or bigint divisor
- [`isNaN()`](/api/primitives#isNaN) — `NaN`, through `Number.isNaN`
- [`isSafeInteger()`](/api/primitives#isSafeInteger) — safe integers, through `Number.isSafeInteger`

### Date validation

- [`date()`](/api/primitives#date) — `Date` instances, rejecting an Invalid Date
- [`isAfter()`](/api/primitives#isAfter) — strictly after a `Date` bound
- [`isBefore()`](/api/primitives#isBefore) — strictly before a `Date` bound

### Length, emptiness, and inclusion

- [`isEmpty()`](/api/primitives#isEmpty) — an observed `length` or `size` of zero
- [`isEndingWith()`](/api/primitives#isEndingWith) — native `String.prototype.endsWith`
- [`isIncluding()`](/api/primitives#isIncluding) — native string, array, or Set inclusion semantics
- [`isLengthAtLeast()`](/api/primitives#isLengthAtLeast) — inclusive lower bound on the observed `length`
- [`isLengthAtMost()`](/api/primitives#isLengthAtMost) — inclusive upper bound on the observed `length`
- [`isLengthExactly()`](/api/primitives#isLengthExactly) — an exact observed `length`
- [`isMatching()`](/api/primitives#isMatching) — regular-expression matching with deterministic state reset
- [`isNotEmpty()`](/api/primitives#isNotEmpty) — an observed `length` or `size` greater than zero
- [`isStartingWith()`](/api/primitives#isStartingWith) — native `String.prototype.startsWith`

### Equality and nullish narrowing

- [`isDefined()`](/api/primitives#isDefined) — rejects `undefined` and removes it from the output, preserving `null`
- [`isEqualTo()`](/api/primitives#isEqualTo) — `Object.is` equality with one primitive expectation, narrowing the output to it
- [`isNonNull()`](/api/primitives#isNonNull) — rejects `null` and removes it from the output, preserving `undefined`
- [`isNonNullish()`](/api/primitives#isNonNullish) — rejects `null` and `undefined` and removes both from the output
- [`isOneOf()`](/api/primitives#isOneOf) — `Object.is` equality against a non-empty tuple of primitives, narrowing to their union

### JSON strings

- [`json()`](/api/primitives#json) — a string that parses as JSON, preserving the string

Each validation step enforces only the condition its name expresses, and preserves the successful value. For example `isGreaterThan(0)` accepts positive infinity; compose `isFinite().isGreaterThan(0)` when both constraints are required.

## String formats

Value-preserving format validators, on [String formats](/api/formats).

### Parsed formats

- [`isEmail()`](/api/formats#isEmail) — pragmatic WHATWG `<input type="email">` pattern
- [`isEmoji()`](/api/formats#isEmoji) — the UTS #51 emoji sequence grammar, or Unicode's RGI set on request
- [`isIp()`](/api/formats#isIp) — IPv4 or IPv6, with range-checked octets and `::` compression
- [`isIsoDate()`](/api/formats#isIsoDate) — `YYYY-MM-DD` calendar date, with impossible dates rejected
- [`isIsoDateTime()`](/api/formats#isIsoDateTime) — a date and time joined by `T`, with an optional offset
- [`isIsoTime()`](/api/formats#isIsoTime) — `HH:MM:SS` time of day, with no time-zone
- [`isJwt()`](/api/formats#isJwt) — three base64url segments with a decodable JOSE header
- [`isUrl()`](/api/formats#isUrl) — WHATWG `URL` parse with a scheme allow-list

### Pattern formats

- [`isBase64()`](/api/formats#isBase64) — standard RFC 4648 base64 with canonical padding
- [`isBase64Url()`](/api/formats#isBase64Url) — unpadded RFC 4648 §5 base64url
- [`isCuid2()`](/api/formats#isCuid2) — CUID2 as `@paralleldrive/cuid2` produces it, capped at 32 characters
- [`isHex()`](/api/formats#isHex) — one or more hexadecimal digits, with no `0x` prefix
- [`isHostname()`](/api/formats#isHostname) — RFC 1123 hostname, labels of 1–63 characters within 253
- [`isMac()`](/api/formats#isMac) — EUI-48 MAC address with `:` or `-` separators
- [`isNanoid()`](/api/formats#isNanoid) — one or more characters of the default Nano ID alphabet
- [`isUlid()`](/api/formats#isUlid) — 26 characters of Crockford base32
- [`isUuid()`](/api/formats#isUuid) — RFC 9562 / RFC 4122 UUID, versions 1–8 plus nil and max

## Structures

Composite and collection schemas, on [Structures](/api/structures).

### Object schemas

- [`looseObject()`](/api/structures#looseObject) — declared own properties validated, unknown own properties preserved
- [`object()`](/api/structures#object) — declared own properties validated, unknown properties omitted from the output
- [`strictObject()`](/api/structures#strictObject) — declared own properties validated, unknown own string and symbol keys rejected

### Collections

- [`array()`](/api/structures#array) — every element validated and transformed in index order
- [`map()`](/api/structures#map) — Map keys and values validated and transformed, with transformed keys kept unique
- [`record()`](/api/structures#record) — every own enumerable entry, open or exhaustively closed by the key schema's domain
- [`set()`](/api/structures#set) — Set items validated and transformed in insertion order, with transformed items kept unique
- [`tuple()`](/api/structures#tuple) — fixed-shape array with per-position schemas and one optional rest region

### Composition

- [`intersection()`](/api/structures#intersection) — executes every branch and composes compatible outputs
- [`union()`](/api/structures#union) — the first successful branch's transformed output, with registration-aware shorthand
- [`variant()`](/api/structures#variant) — direct discriminator lookup that executes only the selected branch

### Class and binary instances

- [`blob()`](/api/structures#blob) — a `Blob`, through a feature-detected global
- [`file()`](/api/structures#file) — a `File`, through a feature-detected global
- [`instance()`](/api/structures#instance) — an `instanceof` check against a class

### Collection size and membership

- [`isIncludingKey()`](/api/structures#isIncludingKey) — Map key membership
- [`isIncludingValue()`](/api/structures#isIncludingValue) — Map value membership
- [`isSizeAtLeast()`](/api/structures#isSizeAtLeast) — inclusive lower bound on a numeric `size`
- [`isSizeAtMost()`](/api/structures#isSizeAtMost) — inclusive upper bound on a numeric `size`
- [`isSizeExactly()`](/api/structures#isSizeExactly) — an exact numeric `size`

### Media types

- [`isMimeType()`](/api/structures#isMimeType) — a value's `type` string against allowed MIME types, with `image/*` wildcards

A one-element tuple marks an object property as optional — see [Optional fields](/api/structures#optional-fields).

## Transforms

Output transformations, on [Transforms](/api/transforms).

### String transforms

- [`toLowercase()`](/api/transforms#toLowercase) — lowercase string
- [`toNormalized()`](/api/transforms#toNormalized) — Unicode normalization
- [`toSplit()`](/api/transforms#toSplit) — split string output
- [`toTrimmed()`](/api/transforms#toTrimmed) — trim both ends
- [`toTrimmedEnd()`](/api/transforms#toTrimmedEnd) — trim the end
- [`toTrimmedStart()`](/api/transforms#toTrimmedStart) — trim the start
- [`toUppercase()`](/api/transforms#toUppercase) — uppercase string

### Array transforms

- [`toFiltered()`](/api/transforms#toFiltered) — filtered array or Set output
- [`toLength()`](/api/transforms#toLength) — length output
- [`toMapped()`](/api/transforms#toMapped) — mapped array or Set output with structured callback failures; Set outputs remain unique
- [`toSliced()`](/api/transforms#toSliced) — sliced output
- [`toSorted()`](/api/transforms#toSorted) — sorted array output

### Collection transforms

- [`toArray()`](/api/transforms#toArray) — convert a Set to an item array
- [`toEntries()`](/api/transforms#toEntries) — Map entries as mutable `[key, value]` tuples
- [`toKeys()`](/api/transforms#toKeys) — Map keys as an array
- [`toMappedKeys()`](/api/transforms#toMappedKeys) — Map key callback transform whose mapped keys stay unique
- [`toMappedValues()`](/api/transforms#toMappedValues) — Map value callback transform
- [`toSize()`](/api/transforms#toSize) — extract a `size` value
- [`toValues()`](/api/transforms#toValues) — Map values as an array

### JSON transforms

- [`toJSONString()`](/api/transforms#toJSONString) — stringify a supported value with JSON semantics
- [`toJSONValue()`](/api/transforms#toJSONValue) — parse a JSON string with `JSON.parse`

### Primitive conversions

- [`toBigint()`](/api/transforms#toBigint) — native `BigInt(value)` conversion
- [`toBoolean()`](/api/transforms#toBoolean) — native `Boolean(value)` truthiness conversion
- [`toDate()`](/api/transforms#toDate) — `Date` from epoch milliseconds or any string accepted by `new Date(value)`
- [`toMappedBoolean()`](/api/transforms#toMappedBoolean) — explicit true/false value mappings for string, number, or bigint
- [`toNumber()`](/api/transforms#toNumber) — native `Number(value)` conversion
- [`toSafeNumber()`](/api/transforms#toSafeNumber) — bigint to number, only within the safe integer range

### General conversion

- [`toString()`](/api/transforms#toString) — convert a value through its own `toString` method

Native conversion steps deliberately follow JavaScript semantics rather than adding hidden policy: `string().toNumber()` may produce `NaN`, and `string().toBoolean()` converts the non-empty string `'false'` to `true`. Native exceptions from `Number()` and `BigInt()` become structured issues. Reach for explicit validation, or for a policy conversion such as `toSafeNumber()` or `toMappedBoolean()`, when a narrower contract is required.

Identity conversions are not exposed: `number().toNumber()`, `boolean().toBoolean()`, and `bigint().toBigint()` are unavailable through the state-aware API. A union or unknown output remains convertible when it is not already entirely the target primitive type.

## Helpers and utilities

Flow control, escape hatches, and type-level utilities, on [Helpers & Utilities](/api/helpers).

### Escape hatches

- [`check()`](/api/helpers#check) — generic custom validation escape hatch
- [`transform()`](/api/helpers#transform) — generic custom output transformation escape hatch

### Flow control

- [`fallback()`](/api/helpers#fallback) — recover earlier validation and operation failures; internal issues are fatal
- [`use()`](/api/helpers#use) — delegate to another schema

### Type-level utilities

- [`as()`](/api/helpers#as) — compile-time assertion with no runtime validation
- [`generic()`](/api/helpers#generic) — lazy or recursive schema construction

### Execution mode

- [`toAsync()`](/api/helpers#toAsync) — force the complete schema to return a native promise

Callback-driven steps may return direct or `PromiseLike` values according to their individual contract.

## Execution result

```ts
type ExecutionResult<T, Issue>
	= | { value: T }
		| { issues: [Issue, ...Issue[]] }

interface ExecutionIssue {
	code: string
	category: 'validation' | 'operation' | 'internal'
	message: string
	path: PropertyKey[]
	payload: unknown
	context?: IssueContext[]
}

interface IssueContext {
	type: string
	[key: string]: unknown
}
```

```ts
const result = await schema.execute(input)

if (v.isSuccess(result)) {
	result.value
}
else {
	result.issues
}
```

## Execution modes

`execute()` preserves synchronous and maybe-asynchronous completion:

```ts
const synchronousResult = v.string()
	.execute('value')

const maybeAsyncSchema = v.string()
	.check(async value => value.length > 0)
const reachedAsyncWork = maybeAsyncSchema.execute('value')
const earlyFailure = maybeAsyncSchema.execute(42)
```

Append `.toAsync()` when every invocation must return a native promise.

## Method chaining

Every step returns a new immutable schema:

```ts
const normalizedName = v.string()
	.toTrimmed()
	.isNotEmpty({ message: 'Required' })
	.toNormalized()
	.toLowercase()
```

## Detailed references

- **[Valchecker 1.0 Contract](/guide/v1-contract)** — normative behavior and compatibility
- **[Primitives](/api/primitives)** — primitive, numeric, string, and narrowing validators
- **[String formats](/api/formats)** — value-preserving string-format validators
- **[Structures](/api/structures)** — object, array, union and intersection
- **[Transforms](/api/transforms)** — output transformations
- **[Helpers & Utilities](/api/helpers)** — flow control and utilities
