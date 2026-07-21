# Migrating to Valchecker 1.0

## Step messages now use options objects

All built-in positional message parameters have been removed before 1.0. Keep one required semantic operand positional and move the message into the trailing options object. Callback configuration such as `thisArg` and `compareFn` belongs to that object as well.

```ts
// Before
v.number().isAtLeast(0, 'Must be non-negative.')
v.array(v.string()).toFiltered(predicate, undefined, 'Filter failed.')

// After
v.number().isAtLeast(0, { message: 'Must be non-negative.' })
v.array(v.string()).toFiltered(predicate, { message: 'Filter failed.' })
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

Length lower-bound payloads now snapshot the actual length used by validation:

```ts
{
	value: { length: number }
	minimum: number
	length: number
}
```

Upper-bound payloads analogously use `maximum`; `isEmpty` and `isNotEmpty` expose `{ value, length }`.

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
