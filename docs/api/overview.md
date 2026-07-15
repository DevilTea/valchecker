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
import { createValchecker, number, object, string } from 'valchecker'

const v = createValchecker({
	steps: [string, number, object],
})
```

Use selective plugins when the importing application needs explicit control over its runtime step set.

## Primitive validators

- `string()` — string values
- `number()` — finite number values
- `boolean()` — boolean values
- `bigint()` — bigint values
- `symbol()` — symbol values
- `literal(value)` — exact literal match
- `null_()` — `null`
- `undefined_()` — `undefined`
- `unknown()` — passthrough typed as `unknown`
- `any()` — passthrough typed as `any`
- `never()` — always fails

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

See [Object schemas](/guide/v1-contract#object-schemas), [Union semantics](/guide/v1-contract#union-semantics), and [Intersection semantics](/guide/v1-contract#intersection-semantics) for exact behavior.

## Constraints

- `min(value)` — minimum numeric value or minimum length
- `max(value)` — maximum numeric value or maximum length
- `integer()` — integer numbers
- `empty()` — values whose supported length is zero
- `startsWith(prefix)` — string prefix
- `endsWith(suffix)` — string suffix

## Transformations

- `transform(fn)` — custom output transformation
- `toTrimmed()` — trim both ends
- `toTrimmedStart()` — trim the start
- `toTrimmedEnd()` — trim the end
- `toUppercase()` — uppercase string
- `toLowercase()` — lowercase string
- `toString()` — convert a supported value to string
- `toSorted(compare?)` — sorted array output
- `toFiltered(predicate)` — filtered array output
- `toSliced(start, end?)` — sliced output
- `toSplitted(separator)` — split string output
- `toLength()` — length output
- `parseJSON()` — parse a JSON string
- `stringifyJSON()` — stringify a supported value
- `json()` — JSON-compatible value validation
- `toAsync()` — force the complete schema to return a native promise

## Flow control

- `check(predicate)` — custom validation
- `fallback(getValue)` — recover from an earlier failure
- `use(schema)` — delegate to another schema
- `as<T>()` — compile-time assertion with no runtime validation
- `generic<T>(factory)` — lazy/recursive schema construction

Callback-driven steps may return direct or `PromiseLike` values according to their individual contract.

## Loose primitives

- `looseNumber()` — accepts supported number-like inputs and produces a number

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

Use the exported helpers or discriminate by `value`/`issues`:

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

`execute()` does not have one universal return shape:

```ts
const synchronousResult = v.string().execute('value')
// ExecutionResult<string>

const maybeAsyncSchema = v.string().check(async value => value.length > 0)
const reachedAsyncWork = maybeAsyncSchema.execute('value')
// Promise<ExecutionResult<string>>

const earlyFailure = maybeAsyncSchema.execute(42)
// Synchronous failure because the async callback is not reached.
```

`await schema.execute(input)` is safe for either mode, but `await` does not change the schema's return type. Append `.toAsync()` when every invocation must return a native promise.

## Method chaining

Every step returns a new immutable schema:

```ts
const schema = v.string()
	.toTrimmed()
	.check(value => value.length > 0, 'Required')
	.toLowercase()
```

## Standard Schema V1

Every schema exposes `~standard` for Standard Schema V1 integrations. It preserves synchronous or asynchronous completion and returns transformed output on success.

## Detailed references

- **[Valchecker 1.0 Contract](/guide/v1-contract)** — normative behavior and compatibility
- **[Primitives](/api/primitives)** — primitive validators
- **[Structures](/api/structures)** — object, array, union and intersection
- **[Transforms](/api/transforms)** — output transformations
- **[Helpers](/api/helpers)** — flow control and utilities
