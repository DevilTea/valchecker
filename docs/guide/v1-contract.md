# Valchecker 1.0 Contract

This page defines the semver-covered compatibility and runtime contract intended for the Valchecker 1.0 release line.

## Runtime and module support

| Contract | Support |
| --- | --- |
| JavaScript module format | ESM only |
| Node.js | 22 or newer |
| CommonJS | Dynamic `import('valchecker')` only |
| Synchronous `require('valchecker')` | Not supported |
| TypeScript module resolution | `NodeNext` and `Bundler` are tested |
| Package artifacts | Runtime ESM and `.d.mts` declarations |

Published tarballs are tested as installed consumer dependencies rather than only through workspace source imports.

## Package boundaries

### `valchecker`

The normal application package exports:

- the default `v` instance containing every built-in step,
- `createValchecker`,
- `allSteps`,
- individual built-in plugins for selective instances,
- public schema, result, and type helpers.

```ts
import { v } from 'valchecker'

const schema = v.object({
	name: v.string().toTrimmed().isNotEmpty(),
	age: v.number().isFinite().isInteger().isAtLeast(0),
})
```

### `@valchecker/all-steps`

Exports the `allSteps` collection and its type for custom instances.

### `@valchecker/internal`

Despite its historical name, this is the supported advanced root API for step-plugin authors. Recorded root exports are semver-covered. Package-private source paths and unexported runtime helpers are not public API.

The public export manifest is stored in `api-surface.json`. CI rejects unreviewed runtime or declaration export drift.

## Built-in naming contract

Built-in APIs communicate their role through naming:

- initial schema steps use nouns or noun phrases,
- built-in validation steps use `isXxx`,
- concrete value transformations use `toXxx`,
- generic high-level operations retain direct names such as `check` and `transform`,
- flow-control and type utilities use their most direct semantic name.

Examples:

```ts
v.string() // initial schema
	.toTrimmed() // concrete transformation
	.isNotEmpty() // built-in validation
	.check(value => value !== 'reserved') // generic validation
```

An initial step may normalize one explicitly documented input representation to its canonical output, as loose primitives do.

## Primitive identity contract

Primitive initial schemas align with JavaScript `typeof` and TypeScript primitive identities:

| Step | Runtime identity |
| --- | --- |
| `string()` | `typeof value === 'string'` |
| `number()` | `typeof value === 'number'` |
| `boolean()` | `typeof value === 'boolean'` |
| `bigint()` | `typeof value === 'bigint'` |
| `symbol()` | `typeof value === 'symbol'` |

Consequently, `number()` accepts finite numbers, `NaN`, `Infinity`, and `-Infinity`.

Runtime number policies are explicit validation steps:

```ts
v.number().isFinite()
v.number().isNaN()
v.number().isInteger()
```

A validation enforces only its stated condition. `isAtLeast(0)` uses numeric comparison and accepts positive infinity. Finite non-negative numbers require `isFinite().isAtLeast(0)`.

## Loose primitive contract

Loose primitive initial schemas accept the primitive or a string compatible with the corresponding TypeScript template-literal primitive type, then normalize to the primitive:

```ts
looseNumber(): number | `${number}` → number
looseBoolean(): boolean | `${boolean}` → boolean
looseBigint(): bigint | `${bigint}` → bigint
```

They do not perform unrestricted JavaScript coercion.

Normative examples:

```ts
v.looseNumber().execute('1e3') // { value: 1000 }
v.looseNumber().execute('') // failure
v.looseNumber().execute('Infinity') // failure
v.looseNumber().execute(Infinity) // success

v.looseBoolean().execute('false') // { value: false }
v.looseBoolean().execute('TRUE') // failure
v.looseBoolean().execute(1) // failure

v.looseBigint().execute('-0x10') // { value: -16n }
v.looseBigint().execute('01') // failure
v.looseBigint().execute('1.0') // failure
```

## Validation contract

Built-in validations preserve the successful value.

- `isAtLeast()` and `isAtMost()` apply to numbers and bigints.
- `isLengthAtLeast()` and `isLengthAtMost()` apply to values with numeric `length`.
- `isInteger()` follows `Number.isInteger`.
- `isFinite()` follows `Number.isFinite`.
- `isNaN()` follows `Number.isNaN`.
- `isEmpty()` checks `length === 0`.
- `isNotEmpty()` checks `length > 0`.
- `isStartingWith()` and `isEndingWith()` follow the corresponding string methods.
- `check()` is the generic validation escape hatch and may use a predicate or type guard according to its overload.

## Transformation contract

Concrete transformations use `toXxx` and replace the successful output value:

- `toTrimmed()`, `toTrimmedStart()`, `toTrimmedEnd()`,
- `toUppercase()`, `toLowercase()`,
- `toSplit()`, `toSliced()`, `toSorted()`, `toFiltered()`,
- `toLength()`, `toString()`,
- `toJSONValue()`, `toJSONString()`.

`transform()` remains the generic arbitrary-output escape hatch.

`toAsync()` changes the execution return mode rather than the successful value.

## Schema immutability

Every fluent method returns a new schema. Existing schemas are not modified.

```ts
const base = v.string()
const trimmed = base.toTrimmed()

base.execute('  value  ') // { value: '  value  ' }
trimmed.execute('  value  ') // { value: 'value' }
```

Schemas may therefore be shared and extended independently.

## Execution contract

### `execute(input)`

`execute()` preserves reached execution mode:

- a fully synchronous pipeline returns a result immediately,
- a pipeline that reaches asynchronous or thenable work returns a native promise,
- a callback-driven pipeline may be maybe-async because an earlier synchronous failure can bypass later asynchronous work.

```ts
const maybeAsync = v.string().check(async value => value.length > 0)

maybeAsync.execute('value') // Promise<ExecutionResult<string>>
maybeAsync.execute(42) // synchronous type failure
```

Valchecker assimilates `PromiseLike` values, including cross-realm promises and custom thenables. Public async completion is normalized to a native promise.

### `.toAsync()`

A schema ending in `.toAsync()` always returns a native promise, including for otherwise synchronous success or early failure.

Use direct execution when preserving synchronous behavior matters. Use `await` when either mode is acceptable.

## Result contract

```ts
type ExecutionSuccessResult<T> = { value: T }
type ExecutionFailureResult<Issue> = { issues: Issue[] }
```

Use `isSuccess()` and `isFailure()` or discriminate by `value` and `issues`.

Validation failures are values, not thrown validation exceptions. User callback exceptions are converted only where the relevant step contract explicitly supports that conversion.

## Standard Schema V1

Every schema exposes `~standard`:

- synchronous validation returns a Standard Schema result directly,
- asynchronous or thenable validation returns a promise,
- success contains transformed output,
- failure contains Standard Schema-compatible issues and paths.

Use `execute()` when Valchecker's complete issue payload is required.

## Message resolution

Issue messages use this priority:

1. custom message supplied to the step,
2. global handler supplied to `createValchecker`,
3. built-in default message,
4. `"Invalid value."`.

Message maps inspect own properties only. Inherited keys are not treated as issue-code handlers.

## Issue paths and reuse

Issue paths are arrays of property keys. Nested validators prepend paths by creating new issue objects rather than mutating child issues.

Custom and delegated schemas may safely return frozen or reused issue objects. Symbol path segments are preserved.

## Object schemas

All object validators read declared fields from own properties only. Inherited values do not satisfy declared fields.

### `object(shape)`

Validates declared fields and returns declared transformed outputs. Unknown input properties are omitted.

### `strictObject(shape)`

Behaves like `object()` and rejects unknown enumerable own string and symbol keys with `strictObject:unexpected_keys`.

### `looseObject(shape)`

Validates declared fields and preserves unknown own properties and descriptors. Declared transformed outputs are materialized as ordinary writable data properties.

### Optional fields

A one-element tuple marks a field optional. The input may omit it; the output contains the declared property with `undefined` when absent.

### `__proto__`

A declared `__proto__` key is created as an own enumerable data property without invoking the legacy prototype setter.

## Arrays

`array(schema)` validates elements in index order and returns their transformed outputs. Nested issues receive numeric indices in their paths.

Earlier synchronous failures can complete before later asynchronous element work is started.

## Union semantics

`union(schemas)` evaluates branches in declaration order and returns the first successful branch's transformed output.

```ts
const schema = v.union([
	v.string().transform(value => value.length),
	v.number(),
])

schema.execute('abc') // { value: 3 }
```

If every branch fails, union returns collected branch issues. Branch order is normative.

## Intersection semantics

`intersection(schemas)` executes all branches and composes compatible outputs.

Only plain objects are recursively composed. Composition supports enumerable string and symbol keys, compatible cycles, shared references, aliases, and accessors whose values are read once per branch output.

Primitive values are compatible when `Object.is(left, right)` is true. The same non-plain object reference is preserved; distinct non-plain instances conflict.

Incompatible outputs fail with `intersection:conflicting_outputs` and retain original branch outputs in the issue payload.

After the first asynchronous branch is reached, remaining branches are started and awaited together. A synchronous failure before asynchronous work remains fail-fast.

## Delegation with `use()`

`use(schema)` preserves delegated transformed output, issue types, and paths. Delegated asynchronous work makes the containing pipeline maybe-async unless it ends with `.toAsync()`.

## Callback and thenable support

Callback steps such as `check`, `transform`, `fallback`, and custom plugin methods may return direct or `PromiseLike` values according to their individual contract.

Do not rely on `instanceof Promise`; Valchecker intentionally supports thenables and cross-realm promises.

## Plugin-author contract

Use `implStepPlugin` and root exports from `@valchecker/internal`.

A plugin method name must:

- be a string,
- refer to a function implementation,
- not duplicate another registered method,
- not collide with a core schema method,
- not be `then`.

`then` is reserved so schemas cannot accidentally become promise-like. Symbol method names are rejected. Non-enumerable own definitions are supported.

Package-private source paths, runtime marker symbols, pipe executor internals, issue-path mutation helpers, and unexported message helpers are not plugin API.

Intentional public API changes must update `api-surface.json`.

## Public API stability

Runtime and declaration export sets are recorded for:

- `valchecker`,
- `@valchecker/all-steps`,
- `@valchecker/internal`.

Adding, removing, renaming, or semantically changing a semver-covered export is a public API decision.

## Benchmark interpretation

Repository benchmarks compare pinned library versions in isolated processes. Construction, cold execution, warmed validation, and tree-shaking are separate categories. Compare only the same scenario and environment, and treat relative margin of error above 5% as unstable.

## 1.0 change policy

After 1.0:

- bug fixes may correct behavior that contradicts this contract,
- backward-compatible additions may extend public API,
- incompatible removal or semantic change requires a major version,
- unexported implementation details may change without notice.

When implementation, tests, and documentation disagree, the discrepancy is a bug to resolve explicitly.