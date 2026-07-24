# Migrating to Valchecker 1.0

This guide covers breaking and newly formalized behavior in `1.0.0-rc.0` for applications and step-plugin authors upgrading from pre-1.0 releases. Read the [Valchecker 1.0 Contract](https://deviltea.github.io/valchecker/guide/v1-contract) for normative post-migration behavior.

## Migration checklist

1. Upgrade to Node.js 22 or newer and use ESM or dynamic `import()`.
2. Replace renamed built-in methods and selective plugin imports.
3. Move built-in messages and optional callback configuration into trailing options objects.
4. Review every `number()` and loose-primitive boundary.
5. Audit `execute()` callers for synchronous or maybe-asynchronous completion.
6. Add `.toAsync()` where an API requires an unconditional native promise.
7. Review structural first-issue behavior and add `collectAllIssues: true` where complete collection is required.
8. Update issue-code, category, payload, path, context, and message handling.
9. Remove imports of accidental implementation exports.
10. Run installed-package consumer tests, not only workspace source tests.

## Step messages use options objects

A message-bearing built-in keeps at most one required semantic operand positional. Optional configuration and `message` belong to one trailing options object.

```ts
// Before
v.number().isAtLeast(0, 'Must be non-negative.')
v.array(v.string()).toFiltered(predicate, undefined, 'Filter failed.')

// After
v.number().isAtLeast(0, { message: 'Must be non-negative.' })
v.array(v.string()).toFiltered(predicate, { message: 'Filter failed.' })
```

## Structural schemas stop after the first recoverable failure

`array()`, `set()`, `map()`, `object()`, `strictObject()`, `looseObject()`, and `intersection()` stop after the first recoverable structural or child failure by default. A failing child may still return multiple issues from its own execution; the parent does not continue to later siblings, items, entries, or branches.

Preserve complete collection explicitly:

```ts
const schema = v.object({
	name: v.string(),
	age: v.number(),
}, { collectAllIssues: true })
```

The same option applies to arrays, Sets, strict/loose objects, and intersections. `map()` keeps all configuration in its required object:

```ts
const schema = v.map({
	key: v.string(),
	value: v.number(),
	collectAllIssues: true,
})
```

Internal issues are always fatal. `union()` and `variant()` are not changed by this option.

## Built-in step renames

Built-in names now expose their pipeline role: initial schemas use nouns, validations use `isXxx`, and concrete transformations use `toXxx`. Generic `check()` and `transform()` remain unchanged.

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

No compatibility aliases are provided. Selective instances must rename imported plugin values as well.

## Issue codes and payloads

Issue codes use the public step name. Update localization maps, monitoring, snapshots, and API clients.

Examples:

| Before | After |
| --- | --- |
| `min:expected_min` | `isAtLeast:expected_at_least` or `isLengthAtLeast:expected_length_at_least` |
| `max:expected_max` | `isAtMost:expected_at_most` or `isLengthAtMost:expected_length_at_most` |
| `integer:expected_integer` | `isInteger:expected_integer` |
| `parseJSON:invalid_json` | `toJSONValue:invalid_json` |
| `stringifyJSON:unserializable` | `toJSONString:unserializable` |
| `transform:failed` | `transform:callback_failed` |
| `toBigint:invalid_bigint` | `toBigint:conversion_failed` |

Numeric bounds use `{ target, value, minimum }` or `{ target, value, maximum }`. Length bounds use qualified keys such as `minimumLength`, `maximumLength`, and snapshot the observed `length`.

Callback result failures remain validation issues; callback throws and rejections are operation issues:

| Step | Issue | Payload |
| --- | --- | --- |
| `check()` returned `false` or a string | `check:failed` | `{ reason, value, returnedMessage? }` |
| `check()` threw or rejected | `check:callback_failed` | `{ phase, value, error }` |
| `transform()` threw or rejected | `transform:callback_failed` | `{ phase, value, error }` |
| `toFiltered()` predicate threw | `toFiltered:callback_failed` | `{ value, item, index, error }` |
| `toSorted()` comparator threw | `toSorted:callback_failed` | `{ value, left, right, error }` |
| `toString()` threw | `toString:conversion_failed` | `{ value, error }` |

`toJSONString()` distinguishes invalid data from execution failure:

- `toJSONString:unserializable` is `validation` with `{ reason, value, at, valueType? }`.
- `toJSONString:serialization_failed` is `operation` with `{ value, at, error }`.

`toNumber:conversion_failed` and `toBigint:conversion_failed` are operation issues. `toJSONValue:invalid_json` remains validation because it represents malformed input.

`toString()` now receives radix through its options object:

```ts
v.number().toString({ radix: 16 })
```

It delegates to the value's own `toString` method; it does not call `String(value)`.

## Primitive semantics

`number()` now matches the TypeScript primitive and checks only `typeof value === 'number'`. It accepts `NaN`, positive infinity, negative infinity, and negative zero.

```ts
const percentage = v.number()
	.isFinite()
	.isAtLeast(0)
	.isAtMost(100)
```

A named validation enforces only its named condition. `isAtLeast(0)` accepts positive infinity; combine it with `isFinite()` when required.

Loose primitives accept the primitive or the corresponding TypeScript-template-compatible string representation, then normalize output. They are not unrestricted constructor coercions.

```ts
v.looseNumber().execute('1e3') // { value: 1000 }
v.looseBoolean().execute('false') // { value: false }
v.looseBigint().execute('-0x10') // { value: -16n }
```

Review counter-intuitive grammar such as whitespace-only loose numbers, radix strings, and rejected empty strings.

## ESM and execution mode

Published packages are ESM-only and require Node.js 22 or newer. Synchronous `require('valchecker')` is unsupported; CommonJS can use dynamic import.

A synchronous schema returns directly. A callback-driven schema returns a promise only when asynchronous work is reached, so an earlier type failure may remain synchronous.

```ts
const schema = v.string().check(async value => value.length > 0)

schema.execute('value') // Promise<ExecutionResult<string>>
schema.execute(42) // direct early failure
```

Awaiting either is safe. Append `.toAsync()` when every invocation must return a native promise. PromiseLike values, including custom thenables and cross-realm promises, are assimilated.

## Composition changes

- `union()` returns the first successful branch's transformed output. Internal branch issues are fatal and stop branch fallback.
- `variant()` directly selects one branch through an own discriminator and records branch provenance in `issue.context`.
- `intersection()` recursively composes compatible plain-object outputs. Distinct class, `Date`, `Map`, or other non-plain instances conflict unless they are the same reference.
- Declared object fields are read from own properties only. Missing required fields use the variant-specific `missing_key` issue; present `undefined` still runs the child schema.
- `object()` omits unknown output properties, `strictObject()` rejects unknown enumerable own string and symbol keys, and `looseObject()` preserves unknown own properties and descriptors.
- Optional one-element tuple fields still materialize `undefined` in output when absent.
- `fallback()` recovers validation and operation failures only. Internal issues bypass its callback. A throwing or rejecting callback appends operation issue `fallback:failed` after the original issues.

## Public issue shape and messages

Every public issue includes:

```ts
interface Issue {
	code: string
	category: 'validation' | 'operation' | 'internal'
	payload: unknown
	message: string
	path: PropertyKey[]
	context?: IssueContext[]
}
```

Failure results use a non-empty tuple: `[Issue, ...Issue[]]`.

Message priority is:

1. originating step message,
2. nearest enclosing structure message,
3. further enclosing structure messages,
4. originating instance global resolver,
5. originating step default,
6. `"Invalid value."`.

Structures clone child issues while applying their documented path mapping. Union and variant preserve the child data path and append branch provenance to `context`. Frozen or reused child issues are supported.

## Public API cleanup

Application code imports from `valchecker`. Plugin authors use root exports from `@valchecker/internal`, not source paths. Accidental implementation exports such as `noop`, `returnTrue`, `isPromiseLike`, `createPipeExecutor`, `handleMessage`, `prependIssuePath`, and `resolveMessagePriority` are no longer public.

Plugin method names must be strings, map to functions, remain unique, avoid core method names, and not be `then`. Symbol method names are rejected.

## Standard Schema

Every schema exposes `~standard` for Standard Schema V1. Native application code can continue to use `execute()` for complete Valchecker issue payloads. `use(schema)` preserves delegated output, issue types, paths, and maybe-async behavior.

## Verification after migration

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm api:surface
pnpm publint
pnpm test:package
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm docs:build
```

Also test an installed tarball or registry package under the production module resolution. Workspace imports can hide missing files, invalid export maps, and dependency rewrite problems.

When reporting release-candidate issues, include exact Valchecker, Node.js, and TypeScript versions; module resolution; a minimal schema and input; actual and expected results; and whether execution used `execute()` or `~standard`.
