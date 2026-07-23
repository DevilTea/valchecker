# Migrating to Valchecker 1.0

## Step messages now use options objects

All built-in positional message parameters have been removed before 1.0. Keep one required semantic operand positional and move the message into the trailing options object. Callback configuration such as `thisArg` and `compareFn` belongs to that object as well.

```ts
// Before
v.number()
	.isAtLeast(0, 'Must be non-negative.')
v.array(v.string())
	.toFiltered(predicate, undefined, 'Filter failed.')

// After
v.number()
	.isAtLeast(0, { message: 'Must be non-negative.' })
v.array(v.string())
	.toFiltered(predicate, { message: 'Filter failed.' })
```
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
10. Add `collectAllIssues: true` where consumers require issues from every structural child.
11. Remove imports of implementation helpers that are no longer exported.
12. Update message maps for renamed issue codes, payload fields, and the required issue `category`.
13. Replace assumptions that failure issue arrays may be empty.
14. Update callback, conversion, JSON, length, and mapped-boolean issue payload handling.
15. Run installed-package consumer tests, not only workspace source tests.

## Structural schemas now stop after the first issue

`array()`, `set()`, `map()`, `object()`, `strictObject()`, `looseObject()`, and `intersection()` now stop after the first recoverable structural or child failure by default. This avoids executing later work that cannot change the failed result and makes the default path suitable for performance-sensitive validation.

A failing child can still return multiple issues from its own execution. The change controls whether the parent structure continues to later siblings, items, entries, or intersection branches.

Before, complete structural collection was implicit:

```ts
const schema = v.object({
	name: v.string(),
	age: v.number(),
})

schema.execute({ name: 1, age: 'old' })
// Previously contained issues for both fields.
```

Preserve that behavior explicitly:

```ts
const schema = v.object({
	name: v.string(),
	age: v.number(),
}, { collectAllIssues: true })

schema.execute({ name: 1, age: 'old' })
// Contains issues for both fields.
```

The same trailing option applies to `array()`, `set()`, `strictObject()`, `looseObject()`, and `intersection()`. `map()` keeps all configuration in its required object:

```ts
const schema = v.map({
	key: v.string(),
	value: v.number(),
	collectAllIssues: true,
})
```

Map defaults are now particularly strict: a failing key skips the current value and stops later entries. With `collectAllIssues: true`, the value is still validated and later entries continue.

Default asynchronous intersections now evaluate branches sequentially after the first reached thenable, so a failed branch does not start later branches. `collectAllIssues: true` keeps complete branch validation and may start remaining asynchronous branches together.

Internal issues remain fatal and always stop later structural work. `union()` and `variant()` are unchanged by this option.

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
| `transform:failed` | `transform:callback_failed` |
| `toBigint:invalid_bigint` | `toBigint:conversion_failed` |

Numeric lower-bound payloads now use:

```ts
{
	target: 'number' | 'bigint'
	value: number | bigint
	minimum: number | bigint
}
```

Length lower-bound payloads now snapshot the actual length used by validation and qualify the bound key as `minimumLength` (distinct from the unqualified `minimum` of the numeric-value bounds):

```ts
{
	value: {
		length: number
	}
	minimumLength: number
	length: number
}
```

Upper-bound payloads analogously use `maximumLength`; `isEmpty` and `isNotEmpty` expose `{ value, length }`.

## Callback, conversion, and JSON issue contracts

Callback result failures remain validation issues, while callback exceptions are operation issues:

| Step | Issue | Payload |
| --- | --- | --- |
| `check()` returned `false` or a string | `check:failed` | `{ reason, value, returnedMessage? }` |
| `check()` threw or rejected | `check:callback_failed` | `{ phase, value, error }` |
| `transform()` threw or rejected | `transform:callback_failed` | `{ phase, value, error }` |
| `toFiltered()` predicate threw | `toFiltered:callback_failed` | `{ value, item, index, error }` |
| `toSorted()` comparator threw | `toSorted:callback_failed` | `{ value, left, right, error }` |
| `toString()` threw | `toString:conversion_failed` | `{ value, error }` |

When `check<AddedIssue>()` uses `addIssue()`, declare the domain issue type explicitly. Added issues remain in the inferred issue and message-handler unions, and they are preserved if the callback later throws or rejects.

`toJSONString()` now distinguishes invalid data from execution failures:

- `toJSONString:unserializable` is a validation issue with `{ reason, value, at, valueType? }`.
- `toJSONString:serialization_failed` is an operation issue with `{ value, at, error }`.

The `at` field is the nested serialization location. Update snapshots that previously expected only `{ value }`.

`toJSONString()` now treats every lossy slot strictly and uniformly. A sparse array hole such as `[1, , 3]` previously serialized to `'[1,null,3]'`; it now fails with `toJSONString:unserializable` carrying `{ reason: 'undefined_result' }` at the hole's path, consistent with how explicit `undefined`, `function`, and `symbol` values already fail.

`toNumber:conversion_failed` and `toBigint:conversion_failed` moved from `category: 'validation'` to `category: 'operation'`. The rule is now explicit: a step whose executing code throws produces an `operation` issue, while static or parse invalidity (such as `toJSONValue:invalid_json`) remains `validation`. Update message maps or handlers that narrow on the category of these two codes.

`toString()` no longer accepts native radix or locale arguments positionally. Move the radix into the trailing options object and add `message` there as well.

```ts
// Before
v.number()
	.toString(16)

// After
v.number()
	.toString({ radix: 16 })
```

`toString()` delegates to the current value's own `toString` instance method (for example `(255).toString(16)`); it does not call `String(value)` and never consults `Symbol.toPrimitive`.

`isIncluding()` now reports the searched-for value under a single `expected` payload key for the string, array, and Set variants. The string variant previously used `search`. Method parameter names are unchanged.

`toMappedBoolean:unmapped_value` now includes immutable schema-time snapshots as `{ value, trueValues, falseValues }`.

`literal()` now uses `Object.is`: `NaN` matches itself, while `0` and `-0` are distinct.

## `number()` now matches TypeScript `number`

Before 1.0, `number()` rejected `NaN` but accepted infinity. It now performs only:

```ts
typeof value === 'number'
```

Therefore all of these succeed:

```ts
v.number()
	.execute(Number.NaN)
v.number()
	.execute(Infinity)
v.number()
	.execute(-Infinity)
```

Add explicit constraints for application policy:

```ts
const finite = v.number()
	.isFinite()
const integer = v.number()
	.isInteger()
const percentage = v.number()
	.isFinite()
	.isAtLeast(0)
	.isAtMost(100)
```

Named validations enforce only their stated condition. `isAtLeast(0)` accepts positive infinity; use `isFinite().isAtLeast(0)` when both are required.

## Loose primitive normalization

`looseNumber()` no longer duplicates the primitive `number()` check. It accepts a number or a string representation compatible with TypeScript's number template-literal type, then outputs a number.

```ts
v.looseNumber()
	.execute('1e3') // { value: 1000 }
v.looseNumber()
	.execute('0x10') // { value: 16 }
v.looseNumber()
	.execute('') // failure
v.looseNumber()
	.execute('Infinity') // failure
v.looseNumber()
	.execute(Infinity) // success
```

New initial schemas apply the same model:

```ts
v.looseBoolean()
	.execute('false') // { value: false }
v.looseBoolean()
	.execute('TRUE') // failure
v.looseBoolean()
	.execute(1) // failure

v.looseBigint()
	.execute('-0x10') // { value: -16n }
v.looseBigint()
	.execute('01') // failure
v.looseBigint()
	.execute('1.0') // failure
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
const result = v.string()
	.toTrimmed()
	.execute(' value ')
```

A callback-driven schema returns a promise only when asynchronous work is reached:

```ts
const schema = v.string()
	.check(async value => value.length > 0)

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
createPipeExecutor
handleMessage
prependIssuePath
resolveMessagePriority
```

Application code should import from `valchecker`. Plugin authors should use root exports from `@valchecker/internal`, not source paths.

`@valchecker/internal` now exports `runtimeExecutionStepDefMarker` (also re-exported from the public `valchecker` package), the shared `Symbol.for('valchecker:runtimeExecutionStepDefMarker')` used to discover registered step-plugin objects. `allSteps` imports this marker instead of re-deriving the symbol string, so the two packages can no longer drift apart.

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
