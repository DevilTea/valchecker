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

<!-- steps: escape-hatches -->

## Flow control

<!-- steps: flow-control -->

## Type-level utilities

<!-- steps: type-level -->

## Execution mode

<!-- steps: execution-mode -->

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
