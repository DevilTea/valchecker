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
		.check(value => value.includes('@'), 'Email must contain @'),
})
```

## Execute Validation

Call `execute()` to validate runtime data:

```ts
const result = await userSchema.execute({
	name: '  Alice  ',
	age: 25,
	email: 'ALICE@EXAMPLE.COM',
})

if (v.isSuccess(result)) {
	console.log(result.value)
	// => { name: 'Alice', age: 25, email: 'alice@example.com' }
}
else {
	console.error(result.issues)
	// Array of structured issues with codes, paths, and messages
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
						.integer()
						.min(1),
				}),
			)
				.toFiltered(({ quantity }) => quantity > 0),
		}),
	)
```

## Async Validation

Mix async steps (database lookups, API calls) seamlessly:

```ts
const usernameSchema = v.string()
	.toTrimmed()
	.check(async (value) => {
		const exists = await db.users.exists(value)
		return exists ? 'Username already taken' : true
	})

const result = await usernameSchema.execute('alice')
```

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

const result = schema.execute({ name: 'Bob', age: 30 })

if (v.isSuccess(result)) {
	// result.value is typed as:
	// { name: string; age: number; isAdult: boolean }
	console.log(result.value.isAdult) // ✓ Type-safe
}
```

## Next Steps

- **[Core Philosophy](/guide/core-philosophy)** - Understand the step pipeline architecture
- **[API Reference](/api/overview)** - Explore all available validation steps
- **[Examples](/examples/async-validation)** - See real-world validation patterns
