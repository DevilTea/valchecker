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

<!-- catalog: primitives -->

Each validation step enforces only the condition its name expresses, and preserves the successful value. For example `isGreaterThan(0)` accepts positive infinity; compose `isFinite().isGreaterThan(0)` when both constraints are required.

## String formats

Value-preserving format validators, on [String formats](/api/formats).

<!-- catalog: formats -->

## Structures

Composite and collection schemas, on [Structures](/api/structures).

<!-- catalog: structures -->

## Transforms

Output transformations, on [Transforms](/api/transforms).

<!-- catalog: transforms -->

Native conversion steps deliberately follow JavaScript semantics rather than adding hidden policy: `string().toNumber()` may produce `NaN`, and `string().toBoolean()` converts the non-empty string `'false'` to `true`. Native exceptions from `Number()` and `BigInt()` become structured issues. Reach for explicit validation, or for a policy conversion such as `toSafeNumber()` or `toMappedBoolean()`, when a narrower contract is required.

Identity conversions are not exposed: `number().toNumber()`, `boolean().toBoolean()`, and `bigint().toBigint()` are unavailable through the state-aware API. A union or unknown output remains convertible when it is not already entirely the target primitive type.

## Helpers and utilities

Flow control, escape hatches, and type-level utilities, on [Helpers & Utilities](/api/helpers).

<!-- catalog: helpers -->

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
