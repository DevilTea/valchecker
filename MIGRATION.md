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

`array()a, `set()`, `map()`, `object()`, `strictObject()`, `looseObject()`, and `intersection()` now stop after the first recoverable structural or child failure by default. This avoids executing later work that cannot change the failed result and makes the default path suitable for performance-sensitive validation.

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

When `check<AddedIssue>()` uses `addIssue()`, declare the domain issue type explicitly. Added issues remain in the inferred issue and message-handle\àÅ’π•ΩπÃ∞ÅÖπêÅ—°ï‰ÅÖ…îÅ¡…ïÕï…ŸïêÅ•òÅ—°îÅçÖ±±âÖç¨Å±Ö—ï»Å—°…Ω›ÃÅΩ»Å…ï©ïç—Ã∏()Å—Ω)M=9M—…•πú†•ÄÅπΩ‹Åë•Õ—•πù’•Õ°ïÃÅ•πŸÖ±•êÅëÖ—ÑÅô…Ω¥Åï·ïç’—•Ω∏ÅôÖ•±’…ïÃË((¥ÅÅ—Ω)M=9M—…•πúÈ’πÕï…•Ö±•ÈÖâ±ïÄÅ•ÃÅÑÅŸÖ±•ëÖ—•Ω∏Å•ÕÕ’îÅ›•—†ÅÅÏÅ…ïÖÕΩ∏∞ÅŸÖ±’î∞ÅÖ–∞ÅŸÖ±’ïQÂ¡î¸ÅıÄ∏(¥ÅÅ—Ω)M