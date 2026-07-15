# Quick Start

Get Valchecker running and validate runtime data with inferred TypeScript input and output types.

## Requirements

- Node.js 22 or newer
- ESM

CommonJS applications may use dynamic `import('valchecker')`. Synchronous `require('valchecker')` is not supported.

## Installation

```bash
pnpm add valchecker
# or
npm install valchecker
# or
yarn add valchecker
```

## Import strategy

### Default instance

The main package exports `v`, an instance containing every built-in step:

```ts
import { v } from 'valchecker'
```

Use it for the shortest setup and for applications where importing the complete step set is acceptable.

### Custom instance with all steps

```ts
import { allSteps, createValchecker } from 'valchecker'

const v = createValchecker({ steps: allSteps })
```

### Selective steps

Import only the plugins used by the application:

```ts
import {
	createValchecker,
	min,
	number,
	object,
	string,
	toTrimmed,
} from 'valchecker'

const v = createValchecker({
	steps: [string, number, object, min, toTrimmed],
})
```

The runtime and type exports of all published packages are checked against `api-surface.json`.

## Define a schema

```ts
import { v } from 'valchecker'

const userSchema = v.object({
	name: v.string().toTrimmed(),
	age: v.number().integer().min(0),
	email: v.string().toLowercase(),
})
```

Every fluent method returns a new immutable schema. The previous schema can be reused safely.

## Execute validation

```ts
const result = await userSchema.execute({
	name: '  Alice  ',
	age: 25,
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

`await` works for both synchronous and asynchronous pipelines. It does not imply that `execute()` always returns a promise.

## Execution modes

### Synchronous pipelines

A fully synchronous pipeline returns its result immediately:

```ts
const schema = v.string().toTrimmed()
const result = schema.execute(' value ')
// { value: 'value' }
```

### Maybe-async pipelines

Callback-driven pipelines can return either a result or a promise depending on which steps are reached for the current input:

```ts
const schema = v.string().check(async (value) => {
	return value.length > 0
})

const validResult = schema.execute('value')
// Promise<ExecutionResult<string>>

const typeFailure = schema.execute(42)
// Synchronous failure: the async callback is not reached.
```

Valchecker supports native promises, cross-realm promises, and custom `PromiseLike` values.

### Always-async pipelines

Use `.toAsync()` when an API boundary must always return a native promise:

```ts
const schema = v.string()
	.check(async value => value.length > 0)
	.toAsync()

const result = await schema.execute(input)
```

See [Valchecker 1.0 Contract](/guide/v1-contract) for the complete execution semantics.

## Result values

A successful result contains the final transformed value. A failed result contains structured issues.

```ts
type Result<T, Issue>
	= | { value: T }
		| { issues: Issue[] }
```

Each issue contains:

```ts
interface Issue {
	code: string
	path: PropertyKey[]
	message: string
	payload: unknown
}
```

Issue paths are immutable from the parent validator's perspective: nesting a child issue creates a new issue/path rather than mutating the child object.

## Transformations

Transforms update the runtime value and inferred output type:

```ts
const schema = v.string()
	.toTrimmed()
	.transform(value => value.split(','))
	.transform(values => values.length)

const result = await schema.execute('a,b,c')
// Successful value: 3
```

## Fallbacks

`fallback()` runs after an earlier validation failure and can recover with a replacement value:

```ts
const schema = v.number()
	.min(0)
	.fallback(() => 0)

await schema.execute(-5)
// { value: 0 }
```

A fallback callback may also return a `PromiseLike` value, making the reached path asynchronous.

## Object fields

### Required and optional

A one-element tuple marks a field as optional:

```ts
const schema = v.object({
	name: v.string(),
	nickname: [v.string()],
})
```

Object validators read declared fields from own properties only. Inherited prototype values do not satisfy declared fields.

### Object variants

- `object(shape)` validates declared fields and omits unknown properties from output.
- `strictObject(shape)` also rejects unknown enumerable own string and symbol keys.
- `looseObject(shape)` preserves unknown own properties and their descriptors.

## Unions

Branches are evaluated in declaration order. The first successful branch's transformed output is returned:

```ts
const schema = v.union([
	v.string().transform(value => value.length),
	v.number(),
])

await schema.execute('abc')
// { value: 3 }
```

## Delegation

Use `use()` to delegate to another schema while preserving its transformed output and issue types:

```ts
const portSchema = v.number().integer().min(1).max(65535)

const configSchema = v.unknown()
	.parseJSON('Invalid JSON')
	.use(v.object({ port: portSchema }))
```

## Async validation

```ts
const usernameSchema = v.string()
	.toTrimmed()
	.min(3)
	.check(async (value) => {
		const exists = await db.users.exists(value)
		return exists ? 'Username already taken' : true
	})

const result = await usernameSchema.execute('alice')
```

## Type inference

The supported advanced type helpers are exported from `@valchecker/internal`:

```ts
import type { InferInput, InferOutput } from '@valchecker/internal'
import { v } from 'valchecker'

const schema = v.object({
	name: v.string().toTrimmed(),
	tags: [v.array(v.string())],
})

type Input = InferInput<typeof schema>
// { name: string; tags?: string[] | undefined }

type Output = InferOutput<typeof schema>
// { name: string; tags: string[] | undefined }
```

`@valchecker/internal` is the semver-covered advanced package for plugin authors and type helpers. Do not import package-private source paths.

## Standard Schema V1

Valchecker schemas expose the Standard Schema V1 interface:

```ts
const result = schema['~standard'].validate(input)
```

The Standard Schema validator preserves sync/maybe-async behavior and returns transformed output on success.

## Custom messages

Message priority is:

1. custom step message,
2. global `createValchecker` message handler,
3. built-in default message,
4. `"Invalid value."`.

```ts
const schema = v.number()
	.min(1, 'Quantity must be at least 1')
```

## Next steps

- **[Valchecker 1.0 Contract](/guide/v1-contract)** — Complete compatibility and semantic contract
- **[Core Philosophy](/guide/core-philosophy)** — Step pipeline architecture
- **[Custom Steps](/guide/custom-steps)** — Supported plugin-author API
- **[API Reference](/api/overview)** — Built-in validation steps
- **[Examples](/examples/basic-validation)** — Applied patterns
