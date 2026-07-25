# Core Concepts

## Immutable state-aware pipelines

Each fluent call returns a new schema. A reached step may preserve a value, transform it, return structured issues, recover a recoverable failure, or delegate to another schema. Previous schemas remain reusable.

Method names expose roles: nouns initialize a runtime domain, `isXxx` validates, `toXxx` transforms, and direct verbs such as `check`, `transform`, `fallback`, and `use` describe generic or flow-control behavior.

## Primitive identity and policy

`number()` checks `typeof value === 'number'`; `NaN`, infinities, and negative zero therefore succeed. Named policy remains explicit:

```ts
v.number().isFinite().isInteger().isAtLeast(0)
```

A validation enforces only its name. `isAtLeast(0)` accepts positive infinity.

Loose primitives normalize documented typed representations:

```ts
v.looseNumber().execute('1e3') // { value: 1000 }
v.looseBoolean().execute('false') // { value: false }
v.looseBigint().execute('-0x10') // { value: -16n }
```

They do not use unrestricted JavaScript coercion.

## Execution mode

```ts
const maybeAsync = v.string().check(async value => value.length > 0)

maybeAsync.execute('value') // Promise-like completion
maybeAsync.execute(42) // direct early failure
```

Awaiting either is safe. `.toAsync()` forces a native promise for every result.

## Result and issue shape

```ts
type ExecutionResult<Value, Issue>
	= | { value: Value }
		| { issues: [Issue, ...Issue[]] }

interface ExecutionIssue {
	code: string
	category: 'validation' | 'operation' | 'internal'
	payload: unknown
	message: string
	path: PropertyKey[]
	context?: unknown[]
}
```

Use `v.isSuccess()` and `v.isFailure()` to narrow results. Paths identify data locations; optional context records provenance such as union or variant branch selection.

Message resolution order is in [error handling](./error-handling.md#message-resolution).

## Structures

- `object()` validates declared own fields and omits unknown output properties.
- `strictObject()` also rejects unknown enumerable own string and symbol keys.
- `looseObject()` preserves unknown own properties.
- `array()`, `set()`, and `map()` validate and transform members.
- `record()` validates plain-object entries; finite literal key sets become closed and exhaustive.
- `tuple()` validates positional arrays with an optional rest region.
- `union()` returns the first successful branch.
- `variant()` directly selects one configured branch from an own discriminator.
- `intersection()` composes compatible branch outputs.

A one-element tuple marks an object field optional. Missing optional fields still appear in output with `undefined`.

## Failure categories

Validation and operation issues may be recoverable depending on the consuming structure or step. Internal issues are fatal: structures stop, union does not try another branch, and fallback does not run its callback.

## Transformations and inference

Transforms change both runtime output and `InferOutput`. `toJSONValue<T>()` and `as<T>()` assert types; they do not validate the asserted structure. Use `use(schema)` for runtime delegation.
