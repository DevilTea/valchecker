# Migrating to Valchecker 1.0

This guide covers breaking and newly formalized behavior in `1.0.0-rc.0` for applications and step-plugin authors upgrading from pre-1.0 releases.

Read the [Valchecker 1.0 Contract](https://deviltea.github.io/valchecker/guide/v1-contract) for normative post-migration behavior.

## Migration checklist

1. Upgrade to Node.js 22 or newer.
2. Convert synchronous CommonJS imports to ESM or dynamic `import()`.
3. Replace renamed built-in methods and selective plugin imports.
4. Update code that assumed `number()` rejected `NaN`.
5. Review every `looseNumber()` use and adopt the new normalization contract.
6. Add `isFinite()` where finite numbers are required.
7. Audit every `execute()` call for sync or maybe-async behavior.
8. Add `.toAsync()` where an API requires an unconditional promise.
9. Verify unions, intersections, object variants, and issue-path handling.
10. Remove imports of implementation helpers that are no longer exported.
11. Update message maps for renamed issue codes, payload fields, and the required issue `category`.
12. Replace assumptions that failure issue arrays may be empty.
13. Run installed-package consumer tests, not only workspace source tests.

## Built-in step renames

Built-in names now identify their pipeline role: initial schemas use nouns, built-in validations use `isXxx`, and concrete transformations use `toXxx`. Generic `check()` and `transform()` are unchanged.

| Before | After |
| --- | --- |
| `empty()` | `isEmpty()` |
| `integer()` | `isInteger()` |
| `startsWith(prefix)` | `isStartingWith(prefix)` |
| `endsWith(suffix)` | `isEndingWith(suffix)` |
| numeric `min(value)` | `isAtLeast(value)` |
| numeric `max(value)` | `isAtMost(value)` |
| length `min(value)` | `isLengthAtLeast(value)` |
| length `max(value)` | `isLengthAtMost(value)` |
| `parseJSON()` | `toJSONValue()` |
| `stringifyJSON()` | `toJSONString()` |
| `toSplitted()` | `toSplit()` |

Before:

```ts
const schema = v.string()
	.min(3)
	.max(20)
	.startsWith('user_')
```

After:

```ts
const schema = v.string()
	.isLengthAtLeast(3)
	.isLengthAtMost(20)
	.isStartingWith('user_')
```

Selective instances must rename imported plugin values as well:

```ts
import {
	createValchecker,
	isAtLeast,
	isFinite,
	number,
} from 'valchecker'

const v = createValchecker({ steps: [number, isFinite, isAtLeast] })
```

No compatibility aliases are provided in the 1.0 contract.

## Renamed issue codes and payloads

Issue codes now use the public method name. Update localization maps, monitoring rules, snapshots, and API clients.

Examples:

| Before | After |
| --- | --- |
| `min:expected_min` | `isAtLeast:expected_at_least` or `isLengthAtLeast:expected_length_at_least` |
| `max:expected_max` | `isAtMost:expected_at_most` or `isLengthAtMost:expected_length_at_most` |
| `integer:expected_integer` | `isInteger:expected_integer` |
| `empty:expected_empty` | `isEmpty:expected_empty` |
| `parseJSON:invalid_json` | `toJSONValue:invalid_json` |
| `stringifyJSON:unserializable` | `toJSONString:unserializable` |

Numeric lower-bound payloads now use:

```ts
{
	target: 'number' | 'bigint'
	value: number | bigint
	minimum: number | bigint
}
```

Length lower-bound payloads now use:

```ts
{
	value: { length: number }
	minimum: number
}
```

Upper-bound payloads analogously use `maximum`.

## `number()` now matches TypeScript `number`

Before 1.0, `number()` rejected `NaN` but accepted infinity. It now performs only:

```ts
typeof value === 'number'
```

Therefore all of these succeed:

```ts
v.number().execute(Number.NaN)
v.number().execute(Infinity)
v.number().execute(-Infinity)
```

Add explicit constraints for application policy:

```ts
const finite = v.number().isFinite()
const integer = v.number().isInteger()
const percentage = v.number()
	.isFinite()
	.isAtLeast(0)
	.isAtMost(100)
```

Named validations enforce only their stated condition. `isAtLeast(0)` accepts positive infinity; use `isFinite().isAtLeast(0)` when both are required.

## Loose primitive normalization

`looseNumber()` no longer duplicates the primitive `number()` check. It accepts a number or a string representation compatible with TypeScript's number template-literal type, then outputs a number.

```ts
v.looseNumber().execute('1e3') // { value: 1000 }
v.looseNumber().execute('0x10') // { value: 16 }
v.looseNumber().execute('') // failure
v.looseNumber().execute('Infinity') // failure
v.looseNumber().execute(Infinity) // success
```

New initial schemas apply the same model:

```ts
v.looseBoolean().execute('false') // { value: false }
v.looseBoolean().execute('TRUE') // failure
v.looseBoolean().execute(1) // failure

v.looseBigint().execute('-0x10') // { value: -16n }
v.looseBigint().execute('01') // failure
v.looseBigint().execute('1.0') // failure
```

These are not unrestricted JavaScript constructor coercions.

## Runtime and module changes

Published packages are ESM-only and require Node.js 22 or newer.

```ts
import { v } from 'valchecker'
```

Synchronous `require('valchecker')` is unsupported. CommonJS may use:

```js
const { v } = await import('valchecker')
```

Use modern TypeScript resolution such as `NodeNext` or `Bundler`.

## `execute()` is sync or maybe-async

A synchronous schema returns directly:

```ts
const result = v.string().toTrimmed().execute(' value ')
```

A callback-driven schema returns a promise only when asynchronous work is reached:

```ts
const schema = v.string().check(async value => value.length > 0)

schema.execute('value') // Promise<ExecutionResult<string>>
schema.execute(42) // synchronous failure before callback
```

Awaiting either mode is safe. Append `.toAsync()` when every invocation must return a native promise.

Callback steps may assimilate complete `PromiseLike` values, including custom thenables and cross-realm promises.

## Composition changes

### Union

`union()` returns the first successful branch's transformed output. Review branch order and output types.

### Intersection

Only compatible plain-object outputs are recursively composed. Distinct class, `Date`, `Map`, or other non-plain instances conflict unless they are the same reference. Compatible cycles, aliases, and enumerable symbol keys are supported. `intersection:conflicting_outputs` now reports the conflict path, branch pair, values, and a stable reason instead of carrying the complete outputs array.

### Objects

- Declared fields are read from own properties only. Missing required own properties now produce `object:missing_key`, `strictObject:missing_key`, or `looseObject:missing_key`; present `undefined` is still validated by the child schema.
- `object()` omits unknown output properties.
- `strictObject()` rejects unknown enumerable own string and symbol keys, reports `{ keys, expectedKeys }`, and collects unknown, missing, and invalid-known-field issues together.
- `looseObject()` preserves unknown own properties and descriptors.
- Declared `__proto__` fields are safe own data properties.
- A one-element tuple still marks a field optional. When absent, the child schema is skipped and the declared output property is materialized with `undefined`.

### Fatal and recoverable combinator behavior

`union()` and `fallback()` no longer treat internal failures as ordinary alternatives. Union stops at an internal branch issue; fallback does not run its callback. Object and array traversal also stop sibling evaluation once an internal issue is observed. Union branch provenance is available in `issue.context` without changing `issue.path`.

A throwing or rejecting fallback callback now emits an `operation`-category `fallback:failed` issue after the original issues, and `payload.error` is required.

## Issue shape and core failures

Every public Valchecker issue now includes a required `category`:

```ts
category: 'validation' | 'operation' | 'internal'
```

Two-argument `ExecutionIssue<'code', Payload>` declarations remain validation issues by default. Plugin authors must specify the third generic for operation or internal failures. Failure results now use a non-empty tuple, `[Issue, ...Issue[]]`.

`core:unknown_exception` changed its payload field from `value` to `receivedResult` because the captured value is the complete execution result received by the failing step. Message-handler exceptions are represented separately as `core:message_exception`.

Nested message handlers now run after the final path is assembled and may be provided at enclosing object scopes. The priority is leaf step, nearest enclosing structure, outer structures, originating instance global handler, leaf default, then `"Invalid value."`.

## Messages and issue paths

Message priority is:

1. per-step message,
2. global resolver,
3. built-in default,
4. `"Invalid value."`.

Message maps inspect own properties only. Nested paths are prepended by cloning issue objects, so frozen and reused child issues are supported.

## `use()` and Standard Schema

`use(schema)` preserves delegated transformed output, issue types, paths, and maybe-async behavior.

Every schema exposes `~standard` for Standard Schema V1 integrations. Native application code may continue to use `execute()` for complete Valchecker issue payloads.

## Public API cleanup

The following accidental implementation exports are no longer public:

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

Application code should import from `valchecker`. Plugin authors should use root exports from `@valchecker/internal`, not source paths.

Plugin method names must be strings, map to functions, remain unique, avoid core method names, and not be `then`. Symbol method names are rejected.

## Verification after migration

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

Also test an installed tarball or registry package under the same module resolution used in production. Workspace imports can hide missing files, invalid export maps, and dependency rewrite problems.

When reporting release-candidate issues, include the exact Valchecker, Node.js, and TypeScript versions; module resolution; minimal schema and input; actual and expected result; and whether execution used `execute()` or `~standard`.