# Error Handling

Validation failures are structured values rather than thrown validation exceptions.

```ts
type ExecutionResult<Value, Issue>
	= | { value: Value }
		| { issues: [Issue, ...Issue[]] }

interface ExecutionIssue {
	code: string
	category: 'validation' | 'operation' | 'internal'
	payload: unknown
	message: string
	path: PropertyKey[]
	context?: unknown[]
}
```

Use `v.isSuccess()` and `v.isFailure()` and branch on `code`, `category`, `path`, and typed payloads. Do not infer behavior from human-readable messages.

## Message resolution

Messages resolve in this order:

1. originating step custom message;
2. nearest enclosing structure message;
3. further enclosing structure messages;
4. originating Valchecker instance global resolver;
5. originating step default;
6. `"Invalid value."`.

A throwing message handler becomes a `core:message_exception` internal issue at the public boundary.

## Paths and context

Object keys, array/tuple indexes, and symbol keys remain separate path segments. `context` records non-data provenance such as union branch index or variant discriminator selection and must not be conflated with `path`.

## Fallback

`fallback()` recovers validation and operation failures from earlier pipeline work. It does not recover internal issues.

If its callback throws or rejects, the original issues remain and `fallback:failed` is appended as an operation issue. The callback's `receivedIssues` diagnostic snapshot can carry unresolved draft defaults; issues returned publicly finalize normally.

## Callback failures

Built-in callback steps normalize expected callback execution failures into their owned operation issues:

- `check:callback_failed`
- `transform:callback_failed`
- collection callback operation issues
- `fallback:failed`

A callback's ordinary negative return is a separate validation result. For example, `check()` returning `false` or a string emits `check:failed`; throwing or rejecting emits `check:callback_failed`.

Core also normalizes unexpected reached step execution errors into internal issues. Schema-construction misuse may still throw synchronously. Application boundaries should handle both structured execution results and construction/programming errors appropriately.

## External responses

When serializing issues for HTTP or logs, review payloads for sensitive input. Prefer stable codes and paths for machine behavior and localized/custom messages for presentation.
