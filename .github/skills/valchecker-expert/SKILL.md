---
name: valchecker-expert
description: Guide for using Valchecker schemas, state-aware steps, type inference, structured issues, async validation, and integrations.
---

# Valchecker Expert Guide

Use this skill when implementing application validation with Valchecker.

## Quick start

```ts
import { v } from 'valchecker'

const userSchema = v.object({
	name: v.string()
		.toTrimmed()
		.isNotEmpty(),
	email: v.string()
		.toLowercase(),
	age: v.looseNumber()
		.isFinite()
		.isInteger()
		.isAtLeast(0),
})

const result = await userSchema.execute(input)

if (v.isSuccess(result)) {
	console.log(result.value)
}
else {
	console.error(result.issues)
}
```

## Mental model

Method names identify their role:

- initial schemas use nouns: `string()`, `number()`, `object()`, `looseBoolean()`,
- built-in validations use `isXxx()`: `isFinite()`, `isNotEmpty()`, `isLengthAtMost()`,
- concrete transformations use `toXxx()`: `toTrimmed()`, `toSplit()`, `toJSONValue()`,
- generic escape hatches remain `check()` and `transform()`.

Editor autocomplete narrows available methods as the current output type changes.

## Primitive semantics

`number()` accepts every JavaScript number because it matches TypeScript `number`, including `NaN` and positive or negative infinity.

```ts
v.number().isFinite()
v.number().isNaN()
v.number().isInteger()
```

A named validation enforces only its stated condition. Combine constraints explicitly.

Loose primitives accept a primitive or its TypeScript template-literal string representation and normalize the output:

```ts
v.looseNumber() // number | `${number}` → number
v.looseBoolean() // boolean | `${boolean}` → boolean
v.looseBigint() // bigint | `${bigint}` → bigint
```

They do not use unrestricted JavaScript coercion.

## Common schemas

### Strings

```ts
const username = v.string()
	.toTrimmed()
	.toLowercase()
	.isNotEmpty()
	.isLengthAtLeast(3)
	.isLengthAtMost(32)
	.check(value => /^[a-z0-9_-]+$/.test(value))
```

### Numbers

```ts
const port = v.looseNumber()
	.isFinite()
	.isInteger()
	.isAtLeast(1)
	.isAtMost(65535)
```

### Arrays

```ts
const tags = v.array(v.string().toLowercase())
	.isNotEmpty()
	.isLengthAtMost(10)
	.toSorted()
```

### JSON input

```ts
const config = v.string()
	.toJSONValue()
	.use(v.object({ port }))
```

### Async validation

```ts
const email = v.string()
	.toLowercase()
	.check(async (value) => {
		const exists = await checkEmailExists(value)
		return exists ? 'Email already exists' : true
	})
```

A callback-driven schema can be maybe-async. Append `.toAsync()` when every invocation must return a native promise.

## Results

```ts
type Result<T, Issue>
	= | { value: T }
		| { issues: Issue[] }
```

Each issue contains `code`, `message`, `path`, and `payload`. Prefer `v.isSuccess()` and `v.isFailure()` over parsing messages.

## Type inference

Advanced type helpers are exported from `@valchecker/internal`:

```ts
import type { InferInput, InferOutput } from '@valchecker/internal'

type Input = InferInput<typeof userSchema>
type Output = InferOutput<typeof userSchema>
```

Transforms update output inference. One-element tuples mark object fields optional.

## Selective imports

```ts
import {
	createValchecker,
	isAtLeast,
	isFinite,
	number,
} from 'valchecker'

const v = createValchecker({
	steps: [number, isFinite, isAtLeast],
})
```

Use selective instances for bundle-sensitive applications. The default `v` contains every built-in step.

## References

- [Setup](./references/setup.md)
- [Core Concepts](./references/core-concepts.md)
- [Type Inference](./references/type-inference.md)
- [Common Patterns](./references/patterns.md)
- [Error Handling](./references/error-handling.md)
- [Performance](./references/performance.md)
- [Step Reference](./references/step-reference.md)
- [Documentation site](../../../docs/index.md)
