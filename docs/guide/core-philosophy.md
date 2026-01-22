# Core Philosophy

Valchecker is built around modular "steps" that execute in a deterministic pipeline. Each step validates, transforms, or short-circuits data while preserving TypeScript inference. This guide explains the mental model so you can design reliable validation flows and extend the library confidently.

## The Mental Model

```
Input → [Step 1] → [Step 2] → [Step 3] → ... → Output
              ↓          ↓          ↓
           Issues     Issues     Issues
```

Data flows through a pipeline of steps. Each step can:
- **Pass**: Forward the value (possibly transformed) to the next step
- **Fail**: Emit one or more issues and halt the current branch
- **Recover**: Catch failures and provide fallback values

## Everything is a Step

A **step** is a small plugin function that receives the current execution state and returns either a success result or validation issues. Steps are the atomic unit of validation in Valchecker.

```ts
// Using built-in steps
const schema = v.string() // Step 1: Validate string type
	.toTrimmed() // Step 2: Transform by trimming
	.minLength(3) // Step 3: Validate minimum length

// Steps chain together to form a pipeline
```

### Step Categories

Valchecker organizes steps into logical categories:

| Category | Purpose | Examples |
|----------|---------|----------|
| **Primitives** | Type validation | `string()`, `number()`, `boolean()`, `bigint()`, `symbol()` |
| **Structures** | Compound types | `object()`, `array()`, `tuple()`, `record()`, `map()`, `set()` |
| **Constraints** | Value restrictions | `min()`, `max()`, `minLength()`, `maxLength()`, `regex()`, `email()` |
| **Transforms** | Value modification | `toTrimmed()`, `toLowercase()`, `transform()`, `parseJSON()` |
| **Flow Control** | Pipeline behavior | `optional()`, `nullable()`, `fallback()`, `union()`, `check()` |
| **Helpers** | Utility operations | `use()`, `clone()`, `pipe()` |

## The Pipeline Contract

### 1. Schema Creation

Chain steps together. Complex structures like `object`, `array`, `union`, and `intersection` orchestrate nested pipelines internally.

```ts
const userSchema = v.object({
	name: v.string()
		.toTrimmed()
		.minLength(1),
	email: v.string()
		.email(),
	age: v.number()
		.int()
		.min(0)
		.optional(),
})
```

### 2. Execution

Calling `schema.execute(value)` or `schema.run(value)` returns a discriminated union:

```ts
type Result<T>
	= | { isOk: true, value: T } // Success
		| { isOk: false, issues: Issue[] } // Failure
```

### 3. Issue Structure

Each issue includes comprehensive debugging information:

```ts
interface Issue {
	code: string // Identifier like 'string:expected_string'
	message: string // Human-readable error description
	path: PropertyKey[] // Location in nested data: ['user', 'email']
	payload: unknown // Raw metadata about the failure
}
```

### 4. Async Detection

Pipelines automatically switch to async mode when any step returns a `Promise`. Mix sync and async steps freely:

```ts
const pipeline = v.string()
	.toTrimmed()
	.check(async (value) => {
		const exists = await db.users.exists(value)
		return !exists || 'Username already taken'
	})

// Async steps make the entire pipeline async
const result = await pipeline.execute('alice')
```

## Pipeline Execution Flow

### Success Path

When all steps pass, the final transformed value is returned:

```ts
const schema = v.string()
	.toTrimmed()
	.transform(s => s.toUpperCase())

const result = schema.run('  hello  ')
// => { isOk: true, value: 'HELLO' }
```

### Failure Path

When a step fails, execution stops and issues are returned:

```ts
const schema = v.number()
	.min(0)
	.max(100)

const result = schema.run(-5)
// => { isOk: false, issues: [{ code: 'min:expected_min', ... }] }
```

### Recovery Path

`fallback()` catches failures and provides alternative values:

```ts
const schema = v.number()
	.min(0)
	.fallback(() => 0)

schema.run(-5) // => { isOk: true, value: 0 }
schema.run(50) // => { isOk: true, value: 50 }
```

## Message Resolution Priority

Error messages are resolved in the following order:

### 1. Per-step Override

Pass a custom message directly to the step:

```ts
v.number()
	.min(1, 'Quantity must be at least 1')
```

### 2. Global Handler

Define a message resolver when creating the valchecker instance:

```ts
const v = createValchecker({
	steps: allSteps,
	message: ({ code, payload }) => {
		// Use your i18n library
		return i18n.t(`validation.${code}`, payload)
	},
})
```

### 3. Built-in Fallback

Default message from the step implementation.

This allows you to centralize translations while still overriding specific cases.

## Paths and Traceability

Each issue carries a `path` array showing how to reach the failing value:

```ts
const schema = v.object({
	user: v.object({
		contacts: v.array(
			v.object({
				email: v.string()
					.email(),
			})
		),
	}),
})

const result = schema.run({
	user: {
		contacts: [
			{ email: 'valid@test.com' },
			{ email: 'invalid-email' }, // ← This fails
		],
	},
})

// result.issues[0].path === ['user', 'contacts', 1, 'email']
```

This makes it trivial to highlight the exact field in forms or map errors to UI components.

## Type Inference Deep Dive

Valchecker maintains full type inference through every step:

### Basic Inference

```ts
const schema = v.object({
	name: v.string(),
	age: v.number(),
})

type T = v.Infer<typeof schema>
// { name: string; age: number }
```

### Transform Inference

Transforms update the inferred type:

```ts
const schema = v.string()
	.transform(s => s.split(',')) // string → string[]
	.transform(arr => arr.length) // string[] → number

type T = v.Infer<typeof schema> // number
```

### Optional and Nullable

```ts
const schema = v.object({
	required: v.string(),
	optional: v.string()
		.optional(),
	nullable: v.string()
		.nullable(),
	both: v.string()
		.optional()
		.nullable(),
})

type T = v.Infer<typeof schema>
// {
//   required: string
//   optional: string | undefined
//   nullable: string | null
//   both: string | null | undefined
// }
```

### Input vs Output Types

```ts
const schema = v.object({
	name: v.string()
		.toTrimmed(), // Input: string, Output: string (trimmed)
	tags: v.string()
		.transform(s => s.split(',')), // Input: string, Output: string[]
})

type Input = v.InferInput<typeof schema>
// { name: string; tags: string }

type Output = v.Infer<typeof schema>
// { name: string; tags: string[] }
```

## Structural Steps

### Object

Validates object shape and runs nested schemas for each property:

```ts
const schema = v.object({
	name: v.string(),
	address: v.object({
		city: v.string(),
		zip: v.string(),
	}),
})
```

### Array

Validates array type and runs a schema for each element:

```ts
const schema = v.array(v.number()
	.min(0))
```

### Tuple

Validates fixed-length arrays with specific types at each position:

```ts
const schema = v.tuple([
	v.string(), // Position 0
	v.number(), // Position 1
	v.boolean(), // Position 2
])

type T = v.Infer<typeof schema> // [string, number, boolean]
```

### Union

Tries schemas in order, returns first success:

```ts
const schema = v.union([
	v.string(),
	v.number(),
	v.literal(null),
])

type T = v.Infer<typeof schema> // string | number | null
```

### Intersection

Merges multiple object schemas:

```ts
const base = v.object({ id: v.string() })
const timestamped = v.object({ createdAt: v.date() })

const schema = v.intersection([base, timestamped])

type T = v.Infer<typeof schema>
// { id: string; createdAt: Date }
```

## Design Principles

1. **Deterministic**: Same input always produces the same result—no hidden state
2. **Composable**: Steps combine without special handling or configuration
3. **Type-safe**: Full TypeScript inference through transforms, checks, and branches
4. **Extensible**: Add custom steps without modifying core library
5. **Debuggable**: Structured issues with paths enable precise error reporting
6. **Tree-shakable**: Import only what you need for minimal bundle size

## Production Best Practices

### Selective Imports

Use tree-shaking in production to exclude unused steps:

```ts
// Development: convenient
import { allSteps, createValchecker } from 'valchecker'

const v = createValchecker({ steps: allSteps })
```

```ts
// Production: optimized
import { createValchecker, number, object, string } from 'valchecker'

const v = createValchecker({ steps: [string, number, object] })
```

### Schema Reuse

Define schemas once and reuse them—avoid recreating inside hot paths:

```ts
// ✓ Good: Define once, reuse
const userSchema = v.object({ /* ... */ })

function validateUser(input: unknown) {
	return userSchema.run(input)
}

// ✗ Bad: Creates new schema on every call
function validateUser(input: unknown) {
	const schema = v.object({ /* ... */ }) // Wasteful
	return schema.run(input)
}
```

### Observability

Capture `issues` in monitoring tools—they contain structured codes for dashboards:

```ts
const result = schema.run(input)

if (!result.isOk) {
	// Log structured data for monitoring
	logger.warn('Validation failed', {
		issues: result.issues.map(i => ({
			code: i.code,
			path: i.path.join('.'),
		})),
	})
}
```

## Next Steps

- **[Custom Steps](/guide/custom-steps)** - Create your own validation steps
- **[API Reference](/api/overview)** - Explore all available validation steps
- **[Examples](/examples/basic-validation)** - See real-world validation patterns
