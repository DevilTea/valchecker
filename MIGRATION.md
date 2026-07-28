# Migrating to Valchecker 1.0

This guide covers breaking and newly formalized behavior for applications and step-plugin authors upgrading from earlier releases. That behavior ships in `0.0.33`. The 1.0 release candidate it was prepared for was never published, so `0.0.33` is where the 1.0 contract first appears, while the version series stays below 1.0. Read the [Valchecker 1.0 Contract](https://deviltea.github.io/valchecker/guide/v1-contract) for normative behavior.

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

```text
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

## Emoji validation

`isEmoji()` now accepts every structurally valid emoji sequence — the [UTS #51](https://www.unicode.org/reports/tr51/) emoji sequence grammar — where it used to accept only Unicode's RGI set. **A validator that accepts more is a breaking change**: input your schema used to reject now passes.

Named inputs that changed verdict:

| Input | Before | After |
| --- | --- | --- |
| `👍‍👍` (U+1F44D ZWJ U+1F44D) | rejected | accepted |
| `😀‍🚀` (U+1F600 ZWJ U+1F680) | rejected | accepted |
| `1️` (U+0031 U+FE0F) | rejected | accepted |
| `🇦🇦` (U+1F1E6 U+1F1E6) | rejected | accepted |
| `⌚️` (U+231A U+FE0F) | rejected | accepted |
| `🏴󠁵󠁳󠁣󠁡󠁿` (U+1F3F4 + `usca` + U+E007F) | rejected | accepted |
| `👪🏻` (U+1F46A U+1F3FB) | rejected | accepted |
| `🏽` (U+1F3FD), a lone skin-tone modifier | **accepted** | rejected |
| `🦰` (U+1F9B0), a lone hair component | **accepted** | rejected |

The last two are a fix rather than the loosening: `\p{RGI_Emoji}` matches those nine characters on their own, so the previous "exact registered set" accepted a bare component as an emoji. They are still accepted where the grammar gives them a position, so `👨‍🦰` and `👍🏽` are unchanged.

`{ registered: true }` restores the registered set:

```ts
const emoji = v.string()
	.isEmoji({ registered: true })
```

Two things to know before reaching for it. It costs roughly 110× more — about 5,300 ns against 47 ns on a bare emoji — and it needs a runtime with the regular-expression `v` flag, which every supported Node.js has and browsers gained in Chrome 112, Firefox 116, and Safari 17. Where the flag is missing, that call fails with the operation issue `isEmoji:unsupported_registered_set` instead of quietly accepting a different set. It is also not byte-for-byte the old behaviour: the lone-component fix applies to it too, so `🏽`, `🦰`, `👪🏻`, and `👍🏽🏽` are rejected on both accepted sets.

If a schema needs the old accepted set exactly, including the bare components, it needs a `check()` closure over `\p{RGI_Emoji}` rather than this step.

The `isEmoji:expected_emoji` payload gained a `registered` boolean naming which accepted set rejected the value. A message handler reading the payload by destructuring is unaffected; one asserting the payload's exact shape needs updating.

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
const schema = v.string()
	.check(async value => value.length > 0)

const reachedCallback = schema.execute('value') // Promise<ExecutionResult<string>>
const earlyFailure = schema.execute(42) // direct early failure
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
