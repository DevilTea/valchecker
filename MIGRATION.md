# Migrating to Valchecker 1.0

This guide covers breaking or newly formalized behavior in `1.0.0-rc.0`. It is intended for applications and step-plugin authors upgrading from pre-1.0 Valchecker releases.

Read the [Valchecker 1.0 Contract](https://deviltea.github.io/valchecker/guide/v1-contract) for the normative post-migration behavior.

## Migration checklist

1. Upgrade the runtime to Node.js 22 or newer.
2. Convert synchronous CommonJS imports to ESM or dynamic `import()`.
3. Audit every `execute()` call for sync/maybe-async behavior.
4. Add `.toAsync()` where an API requires an unconditional promise.
5. Verify code that depends on `union()` output values.
6. Verify intersections containing class instances, `Date`, `Map`, cycles, or shared references.
7. Audit object inputs that inherit declared fields from a prototype.
8. Audit strict objects with symbol keys and loose objects with unknown fields.
9. Remove imports of implementation helpers that are no longer exported.
10. Run installed-package consumer tests rather than testing only workspace source imports.

## Runtime and module changes

### Node.js 22+

All published packages declare:

```json
{
	"engines": {
		"node": ">=22"
	}
}
```

Older Node.js releases are outside the 1.0 support contract.

### ESM-only packages

Use ESM imports:

```ts
import { v } from 'valchecker'
```

Synchronous CommonJS `require('valchecker')` is not supported.

A CommonJS module may use dynamic import:

```js
const { v } = await import('valchecker')
```

TypeScript consumers should use a modern module resolution mode such as `NodeNext` or `Bundler`.

## `execute()` is sync or maybe-async

A fully synchronous schema returns a result directly:

```ts
const result = v.string().toTrimmed().execute(' value ')
// { value: 'value' }
```

A callback-driven schema may return a promise only when the current input reaches asynchronous work:

```ts
const schema = v.string().check(async value => value.length > 0)

const reachedCallback = schema.execute('value')
// Promise<ExecutionResult<string>>

const failedBeforeCallback = schema.execute(42)
// Synchronous failure result
```

### Migration options

When either completion mode is acceptable, awaiting is safe:

```ts
const result = await schema.execute(input)
```

When a function's declared contract must always return a promise, append `.toAsync()`:

```ts
const asyncSchema = schema.toAsync()
const result = await asyncSchema.execute(input)
```

Do not use `instanceof Promise` as a schema capability test. Valchecker supports native promises, cross-realm promises, and custom thenables.

## Callback steps accept `PromiseLike`

Callbacks used by steps such as `check`, `transform`, `fallback`, and plugin utilities may return direct values or `PromiseLike` values according to their step contract.

Before:

```ts
const schema = v.string().transform(value => Promise.resolve(value.length))
```

Still valid, with additional support for thenables:

```ts
const schema = v.string().transform(value => ({
	then(resolve: (length: number) => void) {
		resolve(value.length)
	},
}))
```

Public asynchronous execution is normalized to a native promise.

## `union()` returns transformed branch output

Pre-1.0 code may have assumed the original input was returned after a successful branch. The 1.0 contract returns the first successful branch's transformed output.

```ts
const schema = v.union([
	v.string().transform(value => value.length),
	v.number(),
])

await schema.execute('abc')
// { value: 3 }
```

Review unions whose branches transform to different output types. Branch order remains significant.

## `intersection()` uses graph-aware composition

Only compatible plain-object outputs are recursively composed.

Supported composition includes:

- nested plain objects,
- enumerable string and symbol keys,
- compatible cycles,
- one-sided cycles,
- shared references and aliases,
- same-reference non-plain objects.

Distinct non-plain objects do not get spread into plain objects:

```ts
const left = new Date(0)
const right = new Date(0)
// Distinct Date instances conflict even when they represent the same time.
```

The same instance is compatible:

```ts
const shared = new Date(0)
// Branches that both return `shared` preserve that reference.
```

Incompatible outputs fail with `intersection:conflicting_outputs`. Review intersections that relied on shallow spreading or structural merging of class instances, `Date`, `Map`, or other non-plain objects.

## Object validators use own properties

Declared fields are read from own properties only. Inherited values no longer satisfy a declared field.

```ts
const input = Object.create({ name: 'inherited' })
await v.object({ name: v.string() }).execute(input)
// Failure at path ['name']
```

Copy inherited values to own properties before validation when that behavior is intentional.

## Object variant behavior

### `object(shape)`

Validates declared own fields and omits unknown input properties from output.

### `strictObject(shape)`

Rejects unknown enumerable own string and symbol keys. The `strictObject:unexpected_keys` payload uses `PropertyKey[]`.

### `looseObject(shape)`

Preserves unknown own properties and their descriptors. It is not an alias for `object()`.

Declared validated fields are materialized as normal writable data properties. This prevents an input getter or read-only descriptor from retaining an old untransformed value.

### Optional fields

The one-element tuple syntax remains:

```ts
const schema = v.object({
	required: v.string(),
	optional: [v.string()],
})
```

An absent optional property is represented as `undefined` in the declared output.

### Safe `__proto__`

A declared `__proto__` field becomes an own enumerable data property. It does not invoke the legacy prototype setter or mutate the output prototype.

## Issue messages and paths

Message resolution is now explicitly:

1. custom step message,
2. global message handler,
3. built-in default message,
4. `"Invalid value."`.

Message maps use own properties only. Inherited names such as `toString` are not treated as issue-code handlers.

Nested issue paths are prepended without mutating the child issue. Custom/delegated schemas may return frozen issues or reuse one issue object across multiple parent paths.

## `use()` preserves delegated output

`use(schema)` delegates through the target schema execution contract and preserves:

- transformed output,
- issue types,
- issue paths,
- maybe-async behavior.

Add `.toAsync()` after the complete pipeline when unconditional promise output is required.

## Public API cleanup

The following names were accidental implementation exports and are no longer public:

```text
noop
returnTrue
isPromiseLike
runtimeExecutionStepDefMarker
createPipeExecutor
handleMessage
prependIssuePath
resolveMessagePriority
```

Remove direct imports of these names. Application schemas should use `valchecker`. Step-plugin authors should use only root exports from `@valchecker/internal`.

Do not import source paths such as:

```ts
// Unsupported
import { something } from '@valchecker/internal/src/...'
```

The supported package export sets are recorded in `api-surface.json` and checked by CI.

## Plugin registration rules

Plugin method names must:

- be strings,
- map to functions,
- not duplicate an existing plugin method,
- not collide with a core schema method,
- not be `then`.

Symbol-named methods are rejected. `then` is reserved to prevent schema objects from becoming accidental thenables. Non-enumerable own method definitions remain supported.

Use `implStepPlugin` and public types exported from `@valchecker/internal`.

## Standard Schema integrations

Every schema exposes Standard Schema V1:

```ts
const result = schema['~standard'].validate(input)
```

The Standard Schema interface preserves synchronous or asynchronous completion and returns transformed output on success.

Framework adapters should prefer `~standard` when accepting multiple validation libraries. Native application code may continue to use `execute()` for Valchecker's complete result and issue payload.

## Package boundary changes

| Package | Supported purpose |
| --- | --- |
| `valchecker` | Application-facing schemas, default `v`, built-in steps and public helpers |
| `@valchecker/all-steps` | `allSteps` for custom instances |
| `@valchecker/internal` | Semver-covered advanced types and step-plugin API |

The word `internal` is historical; its root exports are supported. Non-exported implementation files remain private.

## Verification after migration

Run the repository or application checks under Node.js 22 and 24:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm typecheck
```

For library consumers, also test an installed tarball or registry package with the same module resolution used in production. Workspace source imports can hide missing files, invalid export maps, and dependency rewrite problems.

## Reporting RC problems

Open a GitHub issue with:

- the exact Valchecker version,
- Node.js and TypeScript versions,
- module resolution mode,
- a minimal schema and input,
- actual and expected result,
- whether the behavior occurs through `execute()` or `~standard`.

Release-candidate feedback may result in additional prerelease versions before `1.0.0`.
