# Helpers and Utilities

These steps provide generic validation, arbitrary transformation, recovery, delegation, recursion, type assertions, and execution-mode control.

## `check<AddedIssue = never>(callback, message?)`

`check()` is the generic validation escape hatch. The callback may return `true`, `false`, a failure message, a type-guard result, or a supported `PromiseLike` equivalent.

Built-in issues:

- `check:failed` — category `validation`; payload is either `{ reason: 'returned_false', value }` or `{ reason: 'returned_message', value, returnedMessage }`.
- `check:callback_failed` — category `operation`; payload is `{ phase: 'throw' | 'reject', value, error }`.

```ts
const positive = v.number()
	.check(value => value > 0, { message: 'Must be positive' })
```

Type-guard overloads narrow the output type:

```ts
const schema = v.unknown()
	.check(
		(value): value is string => typeof value === 'string',
	)
```

Declare `AddedIssue` when `addIssue()` introduces a domain issue. The added issue remains in the inferred issue union and in the message-handler union:

```ts
import type { ExecutionIssue } from 'valchecker'

type ReservedIssue = ExecutionIssue<
	'domain:reserved_name',
	{ value: string }
>

const username = v.string()
	.check<ReservedIssue>((value, { addIssue }) => {
		if (value === 'admin') {
			addIssue({
				code: 'domain:reserved_name',
				category: 'validation',
				payload: { value },
				message: 'This name is reserved.',
				path: [],
			})
		}
		return true
	})
```

If a callback throws or rejects after adding issues, Valchecker preserves those issues and appends `check:callback_failed`.

Use built-in named validations when available:

```ts
v.string()
	.isLengthAtLeast(3)
	.isLengthAtMost(20)
v.number()
	.isFinite()
	.isAtLeast(0)
```

## `transform(fn, message?)`

`transform()` is the generic arbitrary-output escape hatch. The inferred output follows the callback result. A thrown or rejected callback emits the operation issue `transform:callback_failed` with `{ phase, value, error }`.

```ts
const schema = v.string()
	.toTrimmed()
	.transform(value => ({ value }))
```

## `fallback(getValue)`

`fallback()` recovers from any earlier failure in the current pipeline by supplying a replacement value.

```ts
const safeNumber = v.number()
	.isAtLeast(0)
	.fallback(() => 0)

safeNumber.execute(-5) // { value: 0 }
safeNumber.execute('invalid') // { value: 0 }
```

A fallback callback may return direct or asynchronous values according to its step contract.

```ts
const config = v.string()
	.toJSONValue()
	.fallback(() => ({ items: [], count: 0 }))
```

## `use(schema)`

Delegates the current value to another Valchecker schema while preserving the delegated transformed output, issue types, paths, and execution mode.

```ts
const normalizedName = v.string()
	.toTrimmed()
	.isNotEmpty()
	.toLowercase()

const user = v.object({
	name: v.unknown()
		.use(normalizedName),
})
```

JSON parsing plus structural validation is a common pattern:

```ts
const port = v.number()
	.isFinite()
	.isInteger()
	.isAtLeast(1)
	.isAtMost(65535)

const config = v.string()
	.toJSONValue({ message: 'Invalid JSON' })
	.use(v.object({ port }))
```

## `as<T>()`

Changes only the compile-time output type. It performs no runtime validation or transformation.

```ts
const schema = v.unknown()
	.as<string>()
```

Use it only when an external invariant already guarantees the asserted type.

## `generic<T>(factory)`

Builds lazy or recursive schemas.

```ts
interface TreeNode {
	value: number
	children?: TreeNode[]
}

const treeSchema = v.object({
	value: v.number(),
	children: [v.array(
		v.generic<{ output: TreeNode }>(() => treeSchema),
	)],
})
```

## `toAsync()`

Forces every invocation of the complete schema to return a native promise, including synchronous successes and early failures.

```ts
const schema = v.string()
	.check(async value => value.length > 0)
	.toAsync()
```

It changes execution mode, not the successful value.

## Loose primitives

Loose primitives are initial schemas, not generic helper coercions:

```ts
v.looseNumber() // number | `${number}` → number
v.looseBoolean() // boolean | `${boolean}` → boolean
v.looseBigint() // bigint | `${bigint}` → bigint
```

They accept only their documented TypeScript-compatible representations:

```ts
v.looseNumber()
	.execute('42') // { value: 42 }
v.looseNumber()
	.execute('') // failure

v.looseBoolean()
	.execute('false') // { value: false }
v.looseBoolean()
	.execute(1) // failure

v.looseBigint()
	.execute('0x10') // { value: 16n }
v.looseBigint()
	.execute('1.0') // failure
```

## `looseObject(shape)`

Validates declared own properties and preserves unknown own properties in the output.

```ts
const schema = v.looseObject({
	name: v.string(),
})

schema.execute({ name: 'Alice', extra: 'preserved' })
// { value: { name: 'Alice', extra: 'preserved' } }
```

This differs from `object()`, which omits unknown output properties, and `strictObject()`, which rejects them.

## Message handling

A global message resolver may be supplied when creating an instance:

```ts
const v = createValchecker({
	steps: allSteps,
	message: ({ code, payload, path }) =>
		i18n.t(`validation.${code}`, { payload, path }),
})
```

Message priority:

1. per-step message,
2. global resolver,
3. built-in default,
4. `"Invalid value."`.

```ts
v.number()
	.isAtLeast(1, { message: ({ payload }) =>
		`Expected at least ${payload.minimum}, received ${payload.value}` })
```

## Working with results

```ts
const result = await schema.execute(input)

if (v.isSuccess(result)) {
	console.log(result.value)
}
else {
	for (const issue of result.issues) {
		console.log(issue.code, issue.path, issue.payload)
	}
}
```

Validation failures are returned values. Applications that prefer exceptions may build a wrapper around `execute()` while retaining structured issues.