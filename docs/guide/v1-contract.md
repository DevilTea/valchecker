# Valchecker 1.0 Contract

This page defines the compatibility contract intended for the Valchecker 1.0 release line. It covers supported runtimes, package boundaries, execution semantics, result and issue behavior, object and composition semantics, and the supported plugin-author surface.

Behavior described here is semver-covered unless a section explicitly labels it as an implementation detail.

## Runtime and module support

| Contract | Support |
| --- | --- |
| JavaScript module format | ESM only |
| Node.js | 22 or newer |
| CommonJS | Dynamic `import('valchecker')` only |
| Synchronous `require('valchecker')` | Not supported |
| TypeScript module resolution | `NodeNext` and `Bundler` are tested |
| Package artifacts | Runtime ESM and `.d.mts` declarations |

Each published package declares `engines.node: ">=22"`. Published tarballs are tested as installed consumer dependencies rather than only through workspace source imports.

## Package boundaries

### `valchecker`

The normal user-facing package. It exports:

- the default `v` instance with all built-in steps,
- `createValchecker`,
- `allSteps`,
- individual built-in step plugins for selective imports,
- public schema/result/type helpers.

Use this package for application schemas.

```ts
import { v } from 'valchecker'

const schema = v.object({
	name: v.string().toTrimmed(),
	age: v.number().integer().min(0),
})
```

### `@valchecker/all-steps`

Exports the `allSteps` collection and its type. It exists for consumers that assemble a custom Valchecker instance without importing the main convenience package.

### `@valchecker/internal`

Despite its historical name, this is the supported advanced API for step-plugin authors. Its recorded public exports are semver-covered. Source files below the package root and implementation helpers that are not exported from the package root are not public API.

The public export manifest is stored in `api-surface.json`. CI rejects unreviewed runtime or declaration export drift.

## Schema immutability

Every fluent method returns a new schema. Existing schemas are not modified.

```ts
const base = v.string()
const trimmed = base.toTrimmed()

base.execute('  value  ')
// { value: '  value  ' }

trimmed.execute('  value  ')
// { value: 'value' }
```

Schemas can therefore be shared and extended independently.

## Execution contract

### `execute(input)`

`execute()` preserves the pipeline's execution mode:

- A fully synchronous pipeline returns an execution result immediately.
- A pipeline that reaches asynchronous or thenable work returns a native `Promise` for the result.
- A callback-driven pipeline may be **maybe-async**: an earlier synchronous failure can return immediately even though a later callback can be asynchronous for other inputs.

```ts
const synchronous = v.string().toTrimmed()
const syncResult = synchronous.execute(' value ')
// ExecutionResult<string>, not a Promise

const maybeAsync = v.string().check(async value => value.length > 0)
const asyncResult = maybeAsync.execute('value')
// Promise<ExecutionResult<string>> for this input

const earlyFailure = maybeAsync.execute(42)
// Synchronous failure because the async callback is never reached
```

Valchecker assimilates `PromiseLike` values, including cross-realm promises and custom thenables. Public async results are normalized to native promises.

### `.toAsync()`

Append `.toAsync()` when the caller requires one stable return shape. The resulting schema always returns a native `Promise`, including for early failures and otherwise synchronous pipelines.

```ts
const schema = v.string()
	.check(async value => value.length > 0)
	.toAsync()

const result = await schema.execute(input)
```

### Recommended call patterns

Use direct execution when preserving synchronous behavior matters:

```ts
const result = schema.execute(input)
if (result instanceof Promise) {
	// Await only when this invocation reached asynchronous work.
}
```

Use `await` when either synchronous or asynchronous completion is acceptable. JavaScript safely awaits non-promises:

```ts
const result = await schema.execute(input)
```

Use `.toAsync()` at API boundaries whose return type must always be a promise.

## Result contract

Execution returns a discriminated union:

```ts
type ExecutionSuccessResult<T> = {
	value: T
}

type ExecutionFailureResult<Issue> = {
	issues: Issue[]
}
```

Use `isSuccess()` and `isFailure()` or discriminate by `value`/`issues`.

```ts
const result = await schema.execute(input)

if (v.isSuccess(result)) {
	result.value
}
else {
	result.issues
}
```

Validation failures are values, not thrown exceptions. Unexpected exceptions from user callbacks are converted to structured issues by the relevant step contract where supported; programming errors outside those boundaries can still throw.

## Standard Schema V1

Every Valchecker schema exposes `~standard` and implements Standard Schema V1 validation semantics.

- Synchronous validation returns a Standard Schema result directly.
- Async or thenable validation returns a promise for that result.
- Success returns the transformed output.
- Failure returns Standard Schema-compatible issues with paths.

```ts
const standardResult = schema['~standard'].validate(input)
```

Use the `~standard` property when integrating with framework code that accepts any Standard Schema implementation. Use `execute()` for the native Valchecker result and complete issue payload.

## Message resolution

Issue messages use this priority, from highest to lowest:

1. the custom message supplied to the step,
2. the global message handler supplied to `createValchecker`,
3. the step's default message,
4. `"Invalid value."`.

Message maps use own properties only. Inherited properties such as `toString` are not treated as issue-code handlers.

## Issue paths and reuse

Issue paths are arrays of property keys. Nested validators prepend paths without mutating an issue object returned by a child schema.

This means custom or delegated schemas may safely:

- reuse issue objects,
- return frozen issues,
- return the same issue to multiple parent paths.

Symbols are preserved as path segments where applicable.

## Object schemas

All object validators read declared fields from **own properties only**. An inherited prototype value does not satisfy a declared field.

```ts
const input = Object.create({ name: 'inherited' })
const result = v.object({ name: v.string() }).execute(input)
// Failure: `name` is not an own property.
```

### `object(shape)`

Validates declared fields and returns an object containing the declared outputs. Unknown input properties are not copied to the output.

### `strictObject(shape)`

Behaves like `object()` and rejects unknown enumerable own keys, including symbol keys.

Unexpected keys are reported by `strictObject:unexpected_keys`; the issue payload contains `PropertyKey[]`.

### `looseObject(shape)`

Validates declared fields and preserves unknown own properties. Unknown-property descriptors are retained. Declared validated properties are materialized as ordinary writable data properties so accessors or read-only input descriptors cannot retain stale pre-validation values.

### Optional fields

A one-element tuple marks an object field as optional:

```ts
const schema = v.object({
	required: v.string(),
	optional: [v.string()],
})
```

The input property may be absent. The output contains the declared property with `undefined` when absent.

### `__proto__`

A declared `__proto__` key is written as an own enumerable data property. It does not invoke the legacy prototype setter and does not mutate the output object's prototype.

## Arrays

`array(schema)` validates elements in index order and returns an array of each element schema's transformed output. Nested issues receive the numeric array index in their path.

Async element work follows the pipeline's maybe-async contract. Earlier synchronous failures can complete before later async work is started.

## Union semantics

`union(schemas)` evaluates branches in declaration order and returns the first successful branch's **transformed output**.

```ts
const schema = v.union([
	v.string().transform(value => value.length),
	v.number(),
])

schema.execute('abc')
// { value: 3 }, not { value: 'abc' }
```

If all branches fail, union returns the collected branch issues. Branch order is part of the contract and can affect both output and performance.

## Intersection semantics

`intersection(schemas)` executes all branches and composes compatible outputs.

### Plain-object composition

Only plain objects are recursively composed. A plain object has either `Object.prototype` or a null prototype in its realm.

Composition includes enumerable string and symbol keys and supports:

- nested objects,
- compatible cycles,
- one-sided cycles,
- shared references and aliases,
- enumerable accessors, whose values are read once per branch output.

Alias topology must remain compatible. A merge that would map one source object to multiple distinct partner objects is rejected.

### Primitive and non-plain outputs

Values are compatible when `Object.is(left, right)` is true.

The same non-plain object reference, such as the same `Date`, `Map`, or class instance, is preserved. Distinct non-plain object instances are not structurally spread or merged; they conflict.

### Conflicts

Incompatible outputs fail with `intersection:conflicting_outputs`. The issue payload contains the original branch outputs.

### Async branches

After the first asynchronous branch is reached, remaining branches are started and awaited together. A synchronous branch failure encountered before async work remains fail-fast.

## Delegation with `use()`

`use(schema)` delegates through the target schema's Valchecker execution contract and preserves:

- the delegated transformed output,
- delegated issue types,
- delegated issue paths.

A delegated async schema makes the containing pipeline maybe-async unless the complete pipeline ends with `.toAsync()`.

## Callback and thenable support

Callback-based steps such as `check`, `transform`, `fallback`, and plugin step callbacks may return either a direct value or a `PromiseLike` value according to their step contract.

Do not rely on `instanceof Promise` behavior. Valchecker intentionally supports thenables and promises created in another JavaScript realm.

## Plugin-author contract

Use `implStepPlugin` and the exported root types from `@valchecker/internal`.

A plugin method name must:

- be a string,
- refer to a function implementation,
- not duplicate another registered method,
- not collide with a core schema method,
- not be `then`.

`then` is reserved so schema objects cannot accidentally become promise-like. Symbol-named methods are rejected. Non-enumerable own method definitions are supported.

The following are not plugin API:

- package-internal source paths,
- runtime marker symbols,
- pipe executor internals,
- issue path mutation helpers,
- message resolution implementation helpers.

An intentional public plugin API change must update `api-surface.json` and pass the API surface gate.

## Public API stability

The runtime and declaration export sets for these packages are recorded and tested:

- `valchecker`,
- `@valchecker/all-steps`,
- `@valchecker/internal`.

Adding, removing, or changing a semver-covered export is a public API decision. Internal helpers must remain unexported rather than being documented as unstable public functions.

## Benchmark interpretation

Repository benchmarks compare Valchecker, Zod 3, Zod 4 JIT, Zod 4 jitless, and Valibot using pinned versions and isolated processes.

Construction, cold execution, and warmed validation are separate categories. Do not combine them into one overall ranking. Compare only the same scenario and environment, and treat relative margin of error above 5% as unstable.

See the repository benchmark guide and generated raw JSON for the complete methodology and samples.

## 1.0 change policy

After 1.0:

- bug fixes may correct behavior that contradicts this contract,
- backward-compatible additions may extend the public API,
- removal or incompatible semantic changes require a new major version,
- implementation details not exported or documented here may change without notice.

When implementation, tests, and documentation disagree, the discrepancy is a bug to resolve explicitly rather than an invitation to infer an undocumented contract.
