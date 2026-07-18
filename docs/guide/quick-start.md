# Quick Start

Get Valchecker running with inferred TypeScript input and transformed output types.

## Requirements

- Node.js 22 or newer
- ESM

CommonJS applications may use dynamic `import('valchecker')`. Synchronous `require('valchecker')` is not supported.

## Installation

```bash
pnpm add valchecker
# or
npm install valchecker
```

## Import strategy

### Default instance

```ts
import { v } from 'valchecker'
```

The default `v` instance contains every built-in step.

### Selective instance

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

Selective imports preserve the fluent API while allowing bundlers to remove unrelated step implementations.

## Understand step names

Valchecker uses method names to communicate pipeline behavior:

- initial schemas use nouns: `string()`, `number()`, `object()`, `looseNumber()`,
- built-in validations use `isXxx()`: `isFinite()`, `isInteger()`, `isLengthAtLeast()`,
- concrete transformations use `toXxx()`: `toTrimmed()`, `toSplit()`, `toJSONValue()`,
- generic escape hatches remain `check()` and `transform()`.

## Define a schema

```ts
import { v } from 'valchecker'

const userSchema = v.object({
	name: v.string()
		.toTrimmed()
		.isNotEmpty(),
	age: v.looseNumber()
		.isFinite()
		.isInteger()
		.isAtLeast(0),
	email: v.string()
		.toLowercase(),
})
```

Every fluent method returns a new immutable schema. Previous schemas remain reusable.

## Execute validation

```ts
const result = await userSchema.execute({
	name: '  Alice  ',
	age: '25',
	email: 'ALICE@EXAMPLE.COM',
})

if (v.isSuccess(result)) {
	console.log(result.value)
	// { name: 'Alice', age: 25, email: 'alice@example.com' }
}
else {
	console.error(result.issues)
}
```

## Primitive number semantics

`number()` follows the TypeScript `number` type and accepts every JavaScript number:

```ts
v.number().execute(Number.NaN) // success
v.number().execute(Infinity) // success
v.number().execute(-Infinity) // success
```

Runtime domain constraints are explicit:

```ts
v.number().isFinite()
v.number().isInteger()
v.number().isFinite().isAtLeast(0).isAtMost(100)
```

A named validation checks only its stated condition. `isAtLeast(0)` therefore accepts positive infinity; combine it with `isFinite()` when finite values are required.

## Loose primitives

Loose primitives accept a primitive or its TypeScript template-literal string representation and normalize the output:

```ts
v.looseNumber().execute('1e3') // { value: 1000 }
v.looseBoolean().execute('false') // { value: false }
v.looseBigint().execute('-0x10') // { value: -16n }
```

They are not unrestricted JavaScript coercion. For example, `looseBoolean()` rejects `1`, `'TRUE'`, and arbitrary truthy strings.

## Execution modes

### Synchronous pipeline

```ts
const schema = v.string().toTrimmed()
const result = schema.execute(' value ')
// { value: 'value' }
```

### Maybe-async pipeline

```ts
const schema = v.string().check(async value => value.length > 0)

const reachedCallback = schema.execute('value')
// Promise<ExecutionResult<string>>

const earlyFailure = schema.execute(42)
// Synchronous failure because the callback is not reached.
```

### Always-async pipeline

```ts
const schema = v.string()
	.check(async value => value.length > 0)
	.toAsync()

const result = await schema.execute(input)
```

`await` is safe for either completion mode. `.toAsync()` changes the execution contract so every call returns a native promise.

## Result values

```ts
type Result<T, Issue>
	= | { value: T }
		| { issues: Issue[] }

interface Issue {
	code: string
	path: PropertyKey[]
	message: string
	payload: unknown
}
```

A successful result contains the final transformed value. A failure contains structured issues. Parent schemas create new nested paths rather than mutating child issue objects.

## Transformations

Concrete transformations expose the resulting representation:

```ts
const schema = v.string()
	.toTrimmed()
	.toSplit(',')
	.toFiltered(value => value.length > 0)
	.toLength()

schema.execute(' a,b,c ')
// { value: 3 }
```

Use `transform()` for arbitrary output changes that do not have a built-in named step.

## Fallbacks

```ts
const schema = v.number()
	.isAtLeast(0)
	.fallback(() => 0)

schema.execute(-5)
// { value: 0 }
```

`fallback()` runs only after an earlier failure and may return direct or asynchronous replacement values.

## Object fields

A one-element tuple marks a field as optional:

```ts
const schema = v.object({
	name: v.string(),
	nickname: [v.string()],
})
```

Object variants:

- `object(shape)` validates declared own properties and omits unknown output properties.
- `strictObject(shape)` rejects unknown enumerable own string and symbol keys.
- `looseObject(shape)` preserves unknown own properties.

## Unions and delegation

Union branches run in declaration order and return the first successful branch's transformed output:

```ts
const schema = v.union([
	v.string().transform(value => value.length),
	v.number(),
])
```

Use `use()` to delegate the current value to another schema:

```ts
const portSchema = v.number()
	.isFinite()
	.isInteger()
	.isAtLeast(1)
	.isAtMost(65535)

const configSchema = v.string()
	.toJSONValue({ message: 'Invalid JSON' })
	.use(v.object({ port: portSchema }))
```

## Type inference

```ts
import type { InferInput, InferOutput } from '@valchecker/internal'
import { v } from 'valchecker'

const schema = v.object({
	count: v.looseNumber().isFinite(),
	tags: [v.array(v.string())],
})

type Input = InferInput<typeof schema>
type Output = InferOutput<typeof schema>
```

`@valchecker/internal` is the semver-covered advanced package for plugin authors and type helpers.

## Message priority

Issue messages resolve in this order:

1. custom step message,
2. global `createValchecker` message handler,
3. built-in default message,
4. `"Invalid value."`.

```ts
const schema = v.number()
	.isAtLeast(1, { message: 'Quantity must be at least 1' })
```

## Next steps

- **[Valchecker 1.0 Contract](/guide/v1-contract)** — Complete semantic contract
- **[Core Philosophy](/guide/core-philosophy)** — API and pipeline principles
- **[Custom Steps](/guide/custom-steps)** — Plugin-author API
- **[API Reference](/api/overview)** — Built-in steps
- **[Examples](/examples/basic-validation)** — Applied patterns