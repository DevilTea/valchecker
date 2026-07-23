# API Overview

This reference summarizes Valchecker's public schema API. The normative compatibility and semantic definition is the [Valchecker 1.0 Contract](/guide/v1-contract).

## Import strategies

### Default instance

```ts
import { v } from 'valchecker'
```

The default instance contains every built-in step.

### Custom instance with all steps

```ts
import { allSteps, createValchecker } from 'valchecker'

const v = createValchecker({ steps: allSteps })
```

### Selective imports

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

## Primitive validators

- `string()` — string values
- `number()` — all JavaScript number values, including `NaN` and positive or negative infinity
- `boolean()` — boolean values
- `bigint()` — bigint values
- `symbol()` — symbol values
- `literal(value)` — exact literal match
- `null()` — `null`
- `undefined()` — `undefined`
- `unknown()` — passthrough typed as `unknown`
- `any()` — passthrough typed as `any`
- `never()` — always fails

Use `number().isFinite()` when the application requires finite numbers.

## Loose primitives

Loose primitives accept the primitive or its corresponding TypeScript template-literal string representation, then produce the canonical primitive:

- `looseNumber()` — ``number | `${number}``` to `number`
- `looseBoolean()` — ``boolean | `${boolean}``` to `boolean`
- `looseBigint()` — ``bigint | `${bigint}``` to `bigint`

They do not perform unrestricted JavaScript coercion. In accordance with TypeScript's ```${number}``` behavior, a non-empty whitespace-only string is accepted by `looseNumber()` and normalized to `0`; the empty string is rejected.

## Structure validators

- `object(shape)` — validates declared own properties and omits unknown properties from output
- `strictObject(shape)` — validates declared own properties and rejects unknown enumerable own string and symbol keys
- `looseObject(shape)` — validates declared own properties and preserves unknown own properties
- `array(elementSchema)` — validates and transforms each array element
- `union(schemas)` — returns the first successful branch's transformed output
- `intersection(schemas)` — composes compatible branch outputs
- `instance(constructor)` — validates a class instance

A one-element tuple marks an object property as optional:

```ts
const schema = v.object({
	required: v.string(),
	optional: [v.number()],
})
```

## Validation steps

- `isAtLeast(value)` / `isAtMost(value)` — inclusive number or bigint bounds
- `isGreaterThan(value)` / `isLessThan(value)` — strict number or bigint bounds
- `isMultipleOf(divisor)` — number or bigint divisibility
- `isInteger()` / `isSafeInteger()` / `isFinite()` / `isNaN()` — explicit number policies
- `isLengthAtLeast(length)` / `isLengthAtMost(length)` / `isLengthExactly(length)` — length constraints
- `isEmpty()` / `isNotEmpty()` — empty and non-empty length-bearing values
- `isStartingWith(prefix)` / `isEndingWith(suffix)` — string prefix and suffix
- `isIncluding(value, options?)` — native string or array inclusion semantics
- `isMatching(pattern)` — regular-expression matching with deterministic state reset
- `isEqualTo(value)` / `isOneOf(values)` — primitive `Object.is` checks with output narrowing
- `isDefined()` / `isNonNull()` / `isNonNullish()` — nullish output narrowing
- `check(predicate)` — generic custom validation escape hatch

Each validation step checks only the condition expressed by its name. For example, `isGreaterThan(0)` accepts positive infinity; use `isFinite().isGreaterThan(0)` when both constraints are required.

`isMultipleOf()` checks bigint remainder exactly. Number inputs use a small floating-point tolerance so ordinary decimal expressions such as `0.3` being a multiple of `0.1` are accepted. Non-finite number inputs fail, while zero and non-finite number divisors are rejected when the schema is constructed.

`isEqualTo()` and `isOneOf()` accept primitive expectations only. They use `Object.is`, so `NaN` equals `NaN` and positive zero differs from negative zero. `isOneOf()` requires a non-empty tuple and snapshots its configured values.

## Transformations

- `transform(fn)` — generic custom output transformation escape hatch
- `toTrimmed()` — trim both ends
- `toTrimmedStart()` — trim the start
- `toTrimmedEnd()` — trim the end
- `toUppercase()` — uppercase string
- `toLowercase()` — lowercase string
- `toNormalized(options?)` — Unicode normalization
- `toNumber(options?)` — native `Number(value)` conversion after any non-number output
- `toBoolean()` — native `Boolean(value)` conversion after any non-boolean output
- `toBigint(options?)` — native `BigInt(value)` conversion after any non-bigint output
- `toSafeNumber(options?)` — bigint to number only within the safe integer range
- `toMappedBoolean(options)` — explicit true/false value mappings for string, number, or bigint
- `toString()` — convert a supported value through its `toString` method
- `toSorted(options?)` — sorted array output
- `toFiltered(predicate, options?)` — filtered array output
- `toMapped(mapper, options?)` — mapped array output with structured callback failures
- `toSliced(start, end?)` — sliced output
- `toSplit(separator, limit?)` — split string output
- `toLength()` — length output
- `toJSONValue(options?)` — parse a JSON string
- `toJSONString(options?)` — stringify a supported value
- `toAsync()` — force the complete schema to return a native promise

Native coercion steps deliberately follow JavaScript semantics. For example, `string().toNumber()` may produce `NaN`, and `string().toBoolean()` converts the non-empty string `'false'` to `true`. Native exceptions from `Number()` and `BigInt()` become structured issues. Use explicit validation or policy conversions when a narrower contract is required.

Identity conversions are not exposed: `number().toNumber()`, `boolean().toBoolean()`, and `bigint().toBigint()` are unavailable through the state-aware API. A union or unknown output remains convertible when it is not already entirely the target primitive type.

`toMapped()` follows synchronous `Array.prototype.map` semantics. A mapper's returned promise remains an array item; it is not awaited. Mapper exceptions become `toMapped:callback_failed` operation issues, while failures outside the mapper remain core internal failures.

`json()` is an initial validator for JSON-compatible values, not a transformation.

## Flow control and type utilities

- `fallback(getValue)` — recover from an earlier failure
- `use(schema)` — delegate to another schema
- `as<T>()` — compile-time assertion with no runtime validation
- `generic<T>(factory)` — lazy or recursive schema construction

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
const schema = v.string()
	.toTrimmed()
	.isNotEmpty({ message: 'Required' })
	.toNormalized()
	.toLowercase()
```

## Detailed references

- **[Valchecker 1.0 Contract](/guide/v1-contract)** — normative behavior and compatibility
- **[Primitives](/api/primitives)** — primitive, numeric, string, and narrowing validators
- **[Structures](/api/structures)** — object, array, union and intersection
- **[Transforms](/api/transforms)** — output transformations
- **[Helpers](/api/helpers)** — flow control and utilities
