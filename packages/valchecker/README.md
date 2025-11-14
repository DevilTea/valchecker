# Valchecker

A powerful and modular TypeScript validation library with full type inference, composable validation steps, and plugin architecture.

## Installation

```bash
npm install valchecker
# or
pnpm add valchecker
# or
yarn add valchecker
```

## Quick Start

```typescript
import { allSteps, createValchecker } from 'valchecker'

// Create a valchecker instance with all available steps
const v = createValchecker({ steps: allSteps })

// Define a schema
const userSchema = v.object({
	name: v.string(),
	age: v.number(),
	email: v.string(),
})

// Validate data
const result = userSchema.execute({
	name: 'John Doe',
	age: 30,
	email: 'john@example.com',
})

// Check the result
if (v.isSuccess(result)) {
	console.log(result.value) // Typed as { name: string; age: number; email: string }
}
else {
	console.log(result.issues) // Array of validation issues
}
```

## Core Concepts

### Creating a Valchecker Instance

Valchecker uses a plugin-based architecture. You need to create a valchecker instance with the steps (plugins) you want to use:

```typescript
import { allSteps, createValchecker } from 'valchecker'

// Or import only the steps you need
import { createValchecker, number, object, string } from 'valchecker'

// Use all available steps
const v = createValchecker({ steps: allSteps })
const v = createValchecker({ steps: [string, number, object] })
```

### Basic Validation

Every schema has an `execute()` method that validates input and returns a result:

```typescript
const schema = v.string()
const result = schema.execute('hello')

// Check if validation succeeded
if (v.isSuccess(result)) {
	console.log(result.value) // 'hello'
}
else {
	console.log(result.issues) // Array of validation errors
}
```

## Basic Types

### String

```typescript
const schema = v.string()

schema.execute('hello') // { value: 'hello' }
schema.execute(123) // { issues: [{ code: 'string:expected_string', ... }] }
```

### Number

```typescript
const schema = v.number()

schema.execute(42) // { value: 42 }
schema.execute('42') // { issues: [{ code: 'number:expected_number', ... }] }
schema.execute(Number.NaN) // { issues: [{ code: 'number:expected_number', ... }] }
```

### Boolean

```typescript
const schema = v.boolean()

schema.execute(true) // { value: true }
schema.execute('true') // { issues: [{ code: 'boolean:expected_boolean', ... }] }
```

### Literal

```typescript
const schema = v.literal('hello')

schema.execute('hello') // { value: 'hello' }
schema.execute('world') // { issues: [...] }
```

### Null, Undefined, Unknown, Never

```typescript
const nullSchema = v.null_()
const undefinedSchema = v.undefined_()
const unknownSchema = v.unknown()
const neverSchema = v.never()
```

## Complex Types

### Object

```typescript
const schema = v.object({
	name: v.string(),
	age: v.number(),
})

schema.execute({ name: 'John', age: 30 })
// { value: { name: 'John', age: 30 } }

// Optional properties
const schemaWithOptional = v.object({
	name: v.string(),
	age: [v.number()], // Wrap in array for optional
})

schemaWithOptional.execute({ name: 'John' })
// { value: { name: 'John', age: undefined } }
```

### Array

```typescript
const schema = v.array(v.string())

schema.execute(['a', 'b', 'c'])
// { value: ['a', 'b', 'c'] }

schema.execute(['a', 123, 'c'])
// { issues: [{ path: [1], code: 'string:expected_string', ... }] }
```

### Union

```typescript
const schema = v.union([v.string(), v.number()])

schema.execute('hello') // { value: 'hello' }
schema.execute(42) // { value: 42 }
schema.execute(true) // { issues: [...] }
```

### Intersection

```typescript
const schema = v.intersection([
	v.object({ name: v.string() }),
	v.object({ age: v.number() }),
])

schema.execute({ name: 'John', age: 30 })
// { value: { name: 'John', age: 30 } }
```

## Chainable Operations

### Check

Add custom validation logic:

```typescript
const positiveNumber = v.number()
	.check(value => value > 0, 'Must be positive')

positiveNumber.execute(5) // { value: 5 }
positiveNumber.execute(-5) // { issues: [{ code: 'check:failed', message: 'Must be positive', ... }] }

// Type narrowing with type guards
const isString = (value: unknown): value is string => typeof value === 'string'
const stringSchema = v.unknown().check(isString)
```

### Transform

Transform validated data:

```typescript
const schema = v.string()
	.transform(value => value.toUpperCase())

schema.execute('hello') // { value: 'HELLO' }

// Async transforms
const asyncSchema = v.string()
	.transform(async (value) => {
		await someAsyncOperation()
		return value.toUpperCase()
	})
```

### Fallback

Provide fallback values on validation failure:

```typescript
const schema = v.number()
	.fallback(() => 0)

schema.execute(42) // { value: 42 }
schema.execute('invalid') // { value: 0 }
```

### Use

Compose schemas by delegating validation to another schema:

```typescript
// Define a reusable email schema
const emailSchema = v.string()
	.toLowercase()
	.toTrimmed()
	.check(x => x.includes('@'))

// Use it in another schema
const userSchema = v.object({
	email: v.unknown().use(emailSchema),
	name: v.string(),
})

userSchema.execute({
	email: '  TEST@EXAMPLE.COM  ',
	name: 'John',
})
// { value: { email: 'test@example.com', name: 'John' } }

// The current value is passed to the provided schema's execute() method,
// and all transformations and validations from that schema are applied
```

## String Operations

Valchecker provides many built-in string manipulation steps:

```typescript
// String transformations
v.string().toUppercase()
v.string().toLowercase()
v.string().toTrimmed()
v.string().toTrimmedStart()
v.string().toTrimmedEnd()

// String validations
v.string().startsWith('hello')
v.string().endsWith('world')
v.string().min(5)
v.string().max(10)

// Chaining
const emailSchema = v.string()
	.toTrimmed()
	.toLowercase()
	.check(value => value.includes('@'), 'Must be a valid email')
```

## Array Operations

```typescript
// Array transformations
v.array(v.number()).toSorted()
v.array(v.string()).toFiltered(x => x.length > 3)
v.array(v.any()).toSliced(0, 10)

// Array validations
v.array(v.string()).min(1) // At least 1 item
v.array(v.string()).max(10) // At most 10 items
v.array(v.string()).min(5).max(5) // Exactly 5 items

// Get array length
v.array(v.string()).toLength() // Returns the length as a number
```

## Advanced Features

### Async Validation

Valchecker automatically handles async operations:

```typescript
const schema = v.string()
	.check(async (value) => {
		const isAvailable = await checkUsernameAvailability(value)
		return isAvailable || 'Username already taken'
	})
	.transform(async (value) => {
		return await normalizeUsername(value)
	})

const result = await schema.execute('john_doe')
```

### Custom Error Messages

```typescript
// Global message handler
const v = createValchecker({
	steps: allSteps,
	message: ({ code, payload }) => {
		if (code === 'string:expected_string') {
			return `Expected string but got ${typeof payload.value}`
		}
		return 'Validation failed'
	},
})

// Per-step message
const schema = v.string('Please provide a valid string')
const schema2 = v.number().min(0, 'Must be non-negative')
```

### Nested Issues with Paths

Validation issues include paths for nested structures:

```typescript
const schema = v.object({
	user: v.object({
		email: v.string(),
	}),
})

const result = schema.execute({
	user: {
		email: 123,
	},
})

// result.issues[0].path === ['user', 'email']
```

### Type Inference

Valchecker provides full TypeScript type inference:

```typescript
const schema = v.object({
	name: v.string(),
	age: v.number(),
})
	.transform(user => ({
		...user,
		isAdult: user.age >= 18,
	}))

const result = schema.execute({ name: 'John', age: 30 })

if (v.isSuccess(result)) {
	// result.value is typed as:
	// { name: string; age: number; isAdult: boolean }
	console.log(result.value.isAdult)
}
```

## Utility Functions

```typescript
// Check if result is successful
v.isSuccess(result) // Type guard: result is { value: T }

// Check if result is failure
v.isFailure(result) // Type guard: result is { issues: ExecutionIssue[] }
```

## License

MIT
