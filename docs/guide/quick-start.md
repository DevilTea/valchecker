# Quick Start

Get valchecker running in minutes and start validating runtime data with full TypeScript type safety.

## Installation

```bash
pnpm add valchecker
# or
npm install valchecker
# or
yarn add valchecker
```

## Import Strategy

Valchecker offers two ways to import validation steps:

### Option 1: All Steps (Convenience)

Import `allSteps` to get every built-in validator. Best for prototyping, CLIs, or apps where bundle size isn't critical.

```ts
import { allSteps, createValchecker } from 'valchecker'

const v = createValchecker({ steps: allSteps })
```

### Option 2: Selective Imports (Tree-Shaking)

Import only the steps you need for maximum bundle optimization.

```ts
import { createValchecker, number, object, string } from 'valchecker'

const v = createValchecker({ steps: [string, number, object] })
```

::: tip Recommended Approach
During development, use `allSteps` for convenience. Before production, analyze your usage and switch to selective imports for smaller bundles.
:::

## Your First Schema

Define a schema by chaining validation and transformation steps:

```ts
const userSchema = v.object({
	name: v.string()
		.toTrimmed(),
	age: v.number()
		.min(0),
	email: v.string()
		.toLowercase()
		.email(),
})
```

Every method call returns a new schema with the step appended. Schemas are immutable and can be safely reused.

## Execute Validation

Valchecker provides two execution methods:

### `execute()` - Always Async

Use `execute()` when your pipeline contains async steps or when you prefer consistent async handling:

```ts
const result = await userSchema.execute({
	name: '  Alice  ',
	age: 25,
	email: 'ALICE@EXAMPLE.COM',
})

if (result.isOk) {
	console.log(result.value)
	// => { name: 'Alice', age: 25, email: 'alice@example.com' }
}
else {
	console.error(result.issues)
	// Array of structured issues with codes, paths, and messages
}
```

### `run()` - Sync When Possible

Use `run()` for purely synchronous pipelines. Returns a `MaybePromise`:

```ts
const result = userSchema.run({ name: 'Bob', age: 30, email: 'bob@test.com' })

// If sync, result is immediately available
// If async, result is a Promise
```

## Understanding Results

Every validation returns a discriminated union result:

```ts
type ValidationResult<T>
	= | { isOk: true, value: T }
		| { isOk: false, issues: Issue[] }
```

### Working with Issues

Each issue contains structured information for debugging and user feedback:

```ts
interface Issue {
	code: string // e.g., 'string:expected_string', 'min:expected_min'
	path: PropertyKey[] // e.g., ['users', 0, 'email']
	message: string // Human-readable message
	payload: unknown // Issue-specific data
}
```

Example of handling issues:

```ts
const result = await userSchema.execute({ name: '', age: -5, email: 'invalid' })

if (!result.isOk) {
	for (const issue of result.issues) {
		console.log(`[${issue.code}] ${issue.path.join('.')}: ${issue.message}`)
	}
	// [minLength:expected_min_length] name: Expected minimum length of 1
	// [min:expected_min] age: Expected minimum value of 0
	// [email:expected_email] email: Expected a valid email address
}
```

## Transform and Fallback

Chain transformations and provide fallback values for resilient pipelines:

```ts
const payloadSchema = v.unknown()
	.parseJSON('Invalid JSON')
	.fallback(() => ({ items: [] }))
	.check(value => Array.isArray(value.items), 'items must be an array')
	.use(
		v.object({
			items: v.array(
				v.object({
					id: v.string()
						.toTrimmed(),
					quantity: v.number()
						.int()
						.min(1),
				}),
			)
				.toFiltered(({ quantity }) => quantity > 0),
		}),
	)
```

### Transform Chain

Transforms update both the runtime value and the TypeScript type:

```ts
const schema = v.string()
	.toTrimmed() // string → string (trimmed)
	.transform(s => s.split(',')) // string → string[]
	.transform(arr => arr.length) // string[] → number

type Output = v.Infer<typeof schema> // number
```

### Fallback Values

`fallback()` catches validation failures and provides alternative values:

```ts
const schema = v.number()
	.min(0)
	.fallback(() => 0)

schema.run(-5) // => { isOk: true, value: 0 }
schema.run(10) // => { isOk: true, value: 10 }
```

## Async Validation

Mix async steps (database lookups, API calls) seamlessly:

```ts
const usernameSchema = v.string()
	.toTrimmed()
	.minLength(3)
	.check(async (value) => {
		const exists = await db.users.exists(value)
		return exists ? 'Username already taken' : true
	})

const result = await usernameSchema.execute('alice')
```

::: warning Async Detection
When a pipeline contains async steps, `run()` returns a `Promise`. Use `execute()` if you want consistent async behavior.
:::

## Type Inference

Valchecker automatically infers output types through the entire pipeline:

```ts
const schema = v.object({
	name: v.string(),
	age: v.number(),
})
	.transform(user => ({
		...user,
		isAdult: user.age >= 18,
	}))

type User = v.Infer<typeof schema>
// { name: string; age: number; isAdult: boolean }

const result = await schema.execute({ name: 'Bob', age: 30 })

if (result.isOk) {
	// result.value is fully typed
	console.log(result.value.isAdult) // ✓ Type-safe
}
```

### Extracting Input Types

Use `v.InferInput` to extract the expected input type:

```ts
const schema = v.object({
	name: v.string()
		.toTrimmed(),
	tags: v.array(v.string())
		.optional(),
})

type Input = v.InferInput<typeof schema>
// { name: string; tags?: string[] | undefined }

type Output = v.Infer<typeof schema>
// { name: string; tags: string[] | undefined }
```

## Standard Schema Compliance

Valchecker implements the [Standard Schema V1](https://github.com/standard-schema/standard-schema) specification, enabling interoperability with Standard Schema compatible libraries:

```ts
import type { StandardSchema } from '@standard-schema/spec'

const userSchema = v.object({
	name: v.string(),
	email: v.string()
		.email(),
})

// Works with any library that accepts StandardSchema
function validate<T>(schema: StandardSchema<T>, input: unknown): T {
	const result = schema['~standard'].validate(input)
	// ...
}
```

## Common Patterns

### Optional Fields

```ts
const schema = v.object({
	required: v.string(),
	optional: v.string()
		.optional(),
	withDefault: v.string()
		.optional()
		.fallback(() => 'default'),
})
```

### Union Types

```ts
const schema = v.union([
	v.string(),
	v.number(),
	v.literal(null),
])

type T = v.Infer<typeof schema> // string | number | null
```

### Nested Objects

```ts
const addressSchema = v.object({
	street: v.string(),
	city: v.string(),
	zip: v.string()
		.regex(/^\d{5}$/),
})

const userSchema = v.object({
	name: v.string(),
	address: addressSchema,
	billingAddress: addressSchema.optional(),
})
```

## Next Steps

- **[Core Philosophy](/guide/core-philosophy)** - Understand the step pipeline architecture
- **[Custom Steps](/guide/custom-steps)** - Create your own validation steps
- **[API Reference](/api/overview)** - Explore all available validation steps
- **[Examples](/examples/basic-validation)** - See real-world validation patterns
