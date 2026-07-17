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

## Primitive validators

- `string()` — string values
- `number()` — all JavaScript number values, including `NaN` and positive or negative infinity
- `boolean()` — boolean values
- `bigint()` — bigint values
- `symbol()` — symbol values
- `literal(value)` — exact literal match
- `null_()` — `null`
- `undefined_()` — `undefined`
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

- `isAtLeast(value)` — minimum number or bigint value
- `isAtMost(value)` — maximum number or bigint value
- `isLengthAtLeast(length)` — minimum length
- `isLengthAtMost(length)` — maximum length
- `isInteger()` — integer numbers
- `isFinite()` — finite numbers
- `isNaN()` — `NaN`
- `isEmpty()` — length equals zero
- `isNotEmpty()` — length is greater than zero
- `isStartingWith(prefix)` — string prefix
- `isEndingWith(suffix)` — string suffix
- `check(predicate)` — generic custom validation escape hatch

Each validation step checks only the condition expressed by its name. For example, `isAtLeast(0)` accepts positive infinity; use `isFinite().isAtLeast(0)` when both constraints are required.

## Transformations

- `transform(fn)` — generic custom output transformation escape hatch
- `toTrimmed()` — trim both ends
- `toTrimmedStart()` — trim the start
- `toTrimmedEnd()` — trim the end
- `toUppercase()` — uppercase string
- `toLowercase()` — lowercase string
- `toNumber()` — native `Number(value)` conversion from string, boolean, or bigint
- `toBoolean()` — native `Boolean(value)` conversion from string, number, or bigint
- `toBigint(message?)` — native `BigInt(value)` conversion from string, number, or boolean
- `toSafeNumber(message?)` — bigint to number only within the safe integer range
- `toMappedBoolean(options, message?)` — explicit true/false value mappings for string, number, or bigint
- `toString()` — convert a supported value through its `toString` method
- `toSorted(compare?)` — sorted array output
- `toFiltered(predicate)` — filtered array output
- `toSliced(start, end?)` — sliced output
- `toSplit(separator, limit?)` — split string output
- `toLength()` — length output
- `toJSONValue()` — parse a JSON string
- `toJSONString()` — stringify a supported value
- `toAsync()` — force the complete schema to return a native promise

Native coercion steps deliberately follow JavaScript semantics. For example, `string().toNumber()` may produce `NaN`, and `string().toBoolean()` converts the non-empty string `'false'` to `true`. Use explicit validation or policy conversions when a narrower contract is required.

Identity conversions are not exposed: `number().toNumber()`, `boolean().toBoolean()`, and `bigint().toBigint()` are unavailable through the state-aware API.

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
		| { issues: Issue[] }

interface ExecutionIssue {
	code: string
	message: string
	path: PropertyKey[]
	payload: unknown
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
const synchronousResult = v.string().execute('value')

const maybeAsyncSchema = v.string().check(async value => value.length > 0)
const reachedAsyncWork = maybeAsyncSchema.execute('value')
const earlyFailure = maybeAsyncSchema.execute(42)
```

Append `.toAsync()` when every invocation must return a native promise.

## Method chaining

Every step returns a new immutable schema:

```ts
const schema = v.string()
	.toTrimmed()
	.isNotEmpty('Required')
	.toLowercase()
```

## Detailed references

- **[Valchecker 1.0 Contract](/guide/v1-contract)** — normative behavior and compatibility
- **[Primitives](/api/primitives)** — primitive and loose primitive validators
- **[Structures](/api/structures)** — object, array, union and intersection
- **[Transforms](/api/transforms)** — output transformations
- **[Helpers](/api/helpers)** — flow control and utilities
