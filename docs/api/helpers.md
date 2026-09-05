<!-- Generated file. Do not edit it: `pnpm docs:api` fails when it stops matching its sources,
and `pnpm docs:api:update` rewrites it.

Each step's entry comes from `packages/internal/src/steps/<name>/<name>.doc.md`. The prose
around them, and the order the sections appear in, come from `scripts/docs-api-templates/<page>.md`. -->

# Helpers and Utilities

These steps provide generic validation, arbitrary transformation, recovery, delegation, recursion, type assertions, and execution-mode control.

<!-- typecheck-prelude
declare const input: unknown
declare const schema: { execute: (input: unknown) => unknown }
declare const i18n: { t: (key: string, params: Record<string, unknown>) => string }
declare const createValchecker: typeof import('valchecker').createValchecker
declare const allSteps: typeof import('valchecker').allSteps
-->

## Escape hatches

Reach for a built-in named validation or transformation first: it carries a semantic issue code, a default message, and its own tests. These two cover the conditions and outputs no built-in expresses.

### `check<AddedIssue = never>(callback, options?)` {#check}

`check()` is the generic validation escape hatch. Under its supported callback contract, `true`,
`undefined`/`void`, or a value returned by `utils.narrow()` passes. Returning `false` or any
string — including the empty string — fails. The callback and its supported results may be direct or
`PromiseLike`; other return types require bypassing the TypeScript contract and are unsupported.

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

Declare `AddedIssue` when `addIssue()` introduces a domain issue. The added issue remains in the
inferred issue union and in the message-handler union:

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

An added issue fails the step even when the callback goes on to pass, as above: the step succeeds
only when nothing was added. If a callback throws or rejects after adding issues, Valchecker
preserves those issues and appends `check:callback_failed`.

**Issues:**

- `check:failed` (`validation`) — the callback returned `false` or a failure message string. Payload
  is either `{ reason: 'returned_false', value }` or
  `{ reason: 'returned_message', value, returnedMessage }`; a returned string is also the issue's
  default message
- `check:callback_failed` (`operation`) — the callback threw or rejected. Payload
  `{ phase: 'throw' | 'reject', value, error }`

### `transform(fn, options?)` {#transform}

`transform()` is the generic arbitrary-output escape hatch, for an output change no `toXxx` step
expresses. The inferred output follows the callback result. The callback may return a direct or a
supported asynchronous value; a promise-like result makes the schema maybe-async.

```ts
const schema = v.string()
	.toTrimmed()
	.transform(value => ({ value }))
```

Type-changing transforms flow into subsequent state-aware methods:

```ts
const tags = v.string()
	.toSplit(',')
	.toMapped(value => value.trim())
	.toFiltered(value => value.length > 0)
```

**Issue code:** `transform:callback_failed` (`operation`) — the callback threw or rejected. Payload
`{ phase, value, error }`, where `phase` is `'throw'` or `'reject'`.

## Flow control

### `fallback(getValue, options?)` {#fallback}

`fallback()` recovers earlier `validation` and `operation` failures in the current pipeline by
supplying a replacement value. An `internal` issue is fatal and bypasses the fallback callback.

```ts
const safeNumber = v.number()
	.isAtLeast(0)
	.fallback(() => 0)

safeNumber.execute(-5) // { value: 0 }
safeNumber.execute('invalid') // { value: 0 }
```

The fallback result must be assignable to the pipeline's current output type. It may be direct or
`PromiseLike`; a callback whose return type is definitely synchronous keeps a synchronous type-level
mode, while a promise-like result makes the schema maybe-async.

```ts
const config = v.string()
	.toJSONValue()
	.fallback(() => ({ items: [], count: 0 }))
```

If the callback itself throws or rejects, the received issues are kept and one more issue is
appended.

**Issue code:** `fallback:failed` (`operation`) — the fallback callback threw or rejected. Payload
`{ receivedIssues, error }`, where `receivedIssues` is a defensive structural snapshot of the
failure the callback was given and `error` is what it threw. The snapshot detaches Valchecker-owned
issue records, paths, context records, payload records, and nested diagnostic containers declared by
their owning protocol. It is intentionally not a generic deep clone: opaque/user-owned payload
values such as objects, arrays, `Error`, `Date`, collections, callbacks, proxies, and schema
references keep their identity. Snapshot issues carry the unresolved step-default message rather
than the finalized one; the issues returned to the caller finalize normally.

### `use(schema)` {#use}

Delegates the current value to another Valchecker schema, keeping the delegated transformed output,
issue types, and paths. Execution mode is kept only when the delegated schema is `'sync'`: every
other delegated mode — including the unconditional `'async'` of a `toAsync()` schema — becomes
`'maybe-async'` here, because `use()` runs the delegate only after the current pipeline succeeds. Call
`toAsync()` on the composed schema when it must always return a native promise.

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

This step owns no issue: it reports whatever the delegated schema reports, unchanged.

## Type-level utilities

### `as<T>()` {#as}

Changes only the compile-time output type. It performs no runtime validation or transformation: the
value reaches the result unchanged, whatever it is.

```ts
const schema = v.unknown()
	.as<string>()
```

Use it only when an external invariant already guarantees the asserted type.

This type-level step emits no issue.

### `generic<T>(factory)` {#generic}

Builds lazy or recursive schemas. `T` declares what the composed step contributes — its `output`,
and optionally its `operationMode` and `issue` — and the argument is either another schema or a
factory returning one. A factory is resolved on every execution, which is what makes a
self-reference possible.

```ts
interface TreeNode {
	value: number
	children?: TreeNode[]
}

const treeSchema = v.object({
	value: v.number(),
	// The factory's `any` return type breaks the inference cycle a bare
	// self-reference would create. The output type still comes from the
	// `generic<{ output: TreeNode }>` argument; the annotation only gives up the
	// check that the factory returns a schema.
	children: [v.array(
		v.generic<{ output: TreeNode }>((): any => treeSchema),
	)],
})
```

`InferOutput<typeof treeSchema>` is `{ value: number, children: TreeNode[] | undefined }`: the
`[schema]` optional-field shorthand always materializes the property, so the output key is present
with `undefined` rather than optional. Use `TreeNode` for the recursive annotation, as above, and
read the schema's own output type when you need the exact shape.

This step owns no issue: the issues are the composed schema's own.

## Execution mode

### `toAsync()` {#toAsync}

Forces every invocation of the complete schema to return a native promise, including otherwise
synchronous successes and early failures.

```ts
const schema = v.string()
	.check(async value => value.length > 0)
	.toAsync()
```

It changes execution mode, not the successful value.

This step emits no issue.

## Message handling

A global message resolver may be supplied when creating an instance:

<!-- typecheck-isolate -->
```ts
const v = createValchecker({
	steps: allSteps,
	message: ({ code, payload, path }) =>
		i18n.t(`validation.${code}`, { payload, path }),
})
```

Message priority:

1. originating step message,
2. nearest enclosing structure message,
3. further enclosing structure messages,
4. originating instance global resolver,
5. originating built-in default,
6. `"Invalid value."`.

A throwing message handler becomes a `core:message_exception` internal issue at the public boundary.

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

Validation failures are returned values with a non-empty issue tuple. Built-in callback execution failures are normalized into their documented operation issues; unexpected reached step failures are normalized into core internal issues. Schema-construction misuse may still throw synchronously.
