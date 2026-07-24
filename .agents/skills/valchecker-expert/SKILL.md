---
name: valchecker-expert
description: Use Valchecker schemas, state-aware steps, structured issues, async execution, selective registration, and TypeScript inference in application code.
---

# Valchecker Expert Guide

Use this skill for application code that consumes Valchecker. Repository maintenance uses `valchecker-dev`.

## Quick start

```ts
import { v } from 'valchecker'

const userSchema = v.object({
	name: v.string().toTrimmed().isNotEmpty(),
	email: v.string().toLowercase(),
	age: v.looseNumber().isFinite().isInteger().isAtLeast(0),
})

const result = await userSchema.execute(input)

if (v.isSuccess(result))
	console.log(result.value)
else
	console.error(result.issues)
```

## Mental model

- initial schemas use nouns: `string()`, `number()`, `object()`, `looseBoolean()`;
- validations use `isXxx()` and preserve successful values;
- concrete transformations use `toXxx()` and change representation;
- generic escape hatches remain `check()` and `transform()`;
- autocomplete narrows available methods as output type changes;
- every fluent call creates a new reusable schema.

`number()` accepts every JavaScript number, including `NaN` and infinities. Add `isFinite()`, `isInteger()`, bounds, or other policy explicitly.

Loose primitives accept the primitive or their supported TypeScript template-literal string representation and normalize to the primitive; they are not unrestricted constructor coercions.

## Execution and results

A reached callback can make a schema maybe-async; an earlier synchronous failure may still return directly. `await schema.execute(input)` is safe for either. Append `.toAsync()` only when every call must return a native promise.

```ts
type Result<Value, Issue>
	= | { value: Value }
		| { issues: [Issue, ...Issue[]] }
```

Public issues contain `code`, `category`, `payload`, `message`, `path`, and optional `context`. Use `v.isSuccess()` and `v.isFailure()` rather than parsing messages.

Message priority is step custom message, nearest enclosing structure message, further enclosing messages, originating instance global resolver, step default, then `"Invalid value."`.

`fallback()` recovers validation and operation failures. Internal issues are fatal and bypass the callback.

## Type inference

Advanced helpers are exported from the semver-covered `@valchecker/internal` root:

```ts
import type { InferInput, InferOutput } from '@valchecker/internal'
```

Transforms update output inference. One-element tuples mark object fields optional and materialize `undefined` when absent.

## Selective registration

```ts
import { createValchecker, isAtLeast, isFinite, number } from 'valchecker'

const v = createValchecker({ steps: [number, isFinite, isAtLeast] })
```

The default `v` registers all built-ins. Use selective instances for bundle-sensitive applications.

## References

- [Setup](./references/setup.md)
- [Core concepts](./references/core-concepts.md)
- [Type inference](./references/type-inference.md)
- [Common patterns](./references/patterns.md)
- [Error handling](./references/error-handling.md)
- [Performance](./references/performance.md)
- [Step inventory](./references/step-reference.md)
- [Documentation site](../../../docs/index.md)
