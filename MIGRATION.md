# Migrating to Valchecker 1.0

This guide covers breaking and newly formalized behavior in `1.0.0-rc.0` for applications and step-plugin authors upgrading from pre-1.0 releases. Read the [Valchecker 1.0 Contract](https://deviltea.github.io/valchecker/guide/v1-contract) for normative behavior.

## Checklist

1. Upgrade to Node.js 22 or newer; packages are ESM-only. CommonJS must use dynamic `import()`.
2. Replace renamed methods and selective plugin imports.
3. Move built-in messages and optional callback configuration into trailing options objects.
4. Review every `number()` and loose-primitive boundary.
5. Audit `execute()` callers for synchronous or maybe-asynchronous completion; add `.toAsync()` where every call must return a native promise.
6. Add `collectAllIssues: true` where complete structural issue collection is required.
7. Update issue codes, categories, payloads, paths, contexts, and message handling.
8. Remove accidental implementation imports and test the installed package.

## Messages and options

A message-bearing built-in keeps at most one required semantic operand positional. Optional configuration and `message` belong to one trailing options object.

```ts
// Before
v.number().isAtLeast(0, 'Must be non-negative.')
v.array(v.string()).toFiltered(predicate, undefined, 'Filter failed.')

// After
v.number().isAtLeast(0, { message: 'Must be non-negative.' })
v.array(v.string()).toFiltered(predicate, { message: 'Filter failed.' })
```

## Structural issue collection

`array()`, `set()`, `map()`, `object()`, `strictObject()`, `looseObject()`, and `intersection()` stop after the first recoverable structural or child failure by default. A failing child may still return multiple issues from its own execution; the parent does not continue to later siblings, items, entries, or branches.

```ts
const schema = v.object({
	name: v.string(),
	age: v.number(),
}, { collectAllIssues: true })

const mapSchema = v.map({
	key: v.string(),
	value: v.number(),
	collectAllIssues: true,
})
```

Internal issues always stop later work. `union()` and `variant()` are not changed by this option.

## Renamed built-ins

Initial schemas use nouns, validations use `isXxx`, and concrete transformations use `toXxx`. Generic `check()` and `transform()` remain unchanged.

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

## Issue contracts

Issue codes use the public step name. Examples:

| Before | After |
| --- | --- |
| `min:expected_min` | `isAtLeast:expected_at_least` or `isLengthAtLeast:expected_length_at_least` |
| `max:expected_max` | `isAtMost:expected_at_most` or `isLengthAtMost:expected_length_at_most` |
| `integer:expected_integer` | `isInteger:expected_integer` |
| `parseJSON:invalid_json` | `toJSONValue:invalid_json` |
| `stringifyJSON:unserializable` | `toJSONString:unserializable` |
| `transform:failed` | `transform:callback_failed` |
| `toBigint:invalid_bigint` | `toBigint:conversion_failed` |

Numeric bounds use `minimum`/`maximum`; length and size bounds use qualified keys such as `minimumLength` and `maximumSize`, and snapshot the observed length or size.

Callback negative results remain validation issues. Throws and rejections are operation issues:

- `check:failed` — `{ reason, value, returnedMessage? }`
- `check:callback_failed` — `{ phase, value, error }`
- `transform:callback_failed` — `{ phase, value, error }`
- `toFiltered:callback_failed` — `{ value, item, index, error }`
- `toSorted:callback_failed` — `{ value, left, right, error }`

`toJSONString:unserializable` is validation; `toJSONString:serialization_failed`, `toNumber:conversion_failed`, and `toBigint:conversion_failed` are operation issues. `toJSONValue:invalid_json` remains validation.

## Primitive semantics

`number()` accepts every JavaScript number, including `NaN`, infinities, and negative zero. Add policy explicitly:

```ts
const percentage = v.number()
	.isFinite()
	.isAtLeast(0)
	.isAtMost(100)
```

A named validation enforces only its stated condition. `isAtLeast(0)` accepts positive infinity.

Loose primitives accept the primitive or the corresponding TypeScript-template-compatible string representation and normalize output. They are not unrestricted constructor coercions.

## Execution mode

A synchronous schema returns directly. A callback-driven schema returns a promise only when async work is reached, so an earlier failure may remain synchronous.

```ts
const schema = v.string().check(async value => value.length > 0)

schema.execute('value') // Promise<ExecutionResult<string>>
schema.execute(42) // direct early failure
```

Awaiting either is safe. `.toAsync()` forces every invocation to return a native promise. PromiseLike values are assimilated.

## Composition and recovery

- `union()` returns the first successful transformed output; internal branch issues are fatal.
- `variant()` selects one branch from an own discriminator and records provenance in `issue.context`.
- `intersection()` composes compatible plain-object outputs. Incompatible outputs fail with `intersection:conflicting_outputs`.
- Declared object fields are read from own properties only. Present `undefined` still runs the child schema.
- `object()` omits unknown output properties, `strictObject()` rejects unknown enumerable own keys, and `looseObject()` preserves unknown own properties.
- `fallback()` recovers validation and operation failures only; internal issues bypass its callback. A callback throw/rejection appends `fallback:failed` after the original issues.

## Public issue shape and messages

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

Failure results use `[Issue, ...Issue[]]`.

Message priority is step message, nearest enclosing structure, outer structures, originating instance global resolver, step default, then `"Invalid value."`.

Structures clone child issues while applying path mapping. Union and variant preserve child data paths and append branch provenance to `context`.

## Public API and Standard Schema

Application code imports from `valchecker`. Plugin authors use root exports from `@valchecker/internal`, not source paths. Every schema exposes `~standard` for Standard Schema V1; native application code can continue to use `execute()` for complete Valchecker issues.

## Verification

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

Test an installed tarball or registry package under production module resolution; workspace imports can hide missing files and export-map errors.
