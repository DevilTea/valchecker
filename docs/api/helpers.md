# Helpers & Utilities

Helper methods control validation flow, compose schemas, and provide utility functions for working with results.

## Flow Control

### `check(predicate, message?)`

Runs a custom validation predicate or type guard.

**Issue Code**: `'check:failed'`

#### Basic Validation

```ts
const positive = v.number()
	.check(value => value > 0, 'Must be positive')

positive.run(5) // { value: 5 }
positive.run(-1) // { issues: [{ code: 'check:failed', message: 'Must be positive' }] }
```

#### Return Values

The check function can return:
- `true`: Validation passes
- `false`: Validation fails with default/custom message
- `string`: Validation fails with that string as the message

```ts
const schema = v.string()
	.check((value) => {
		if (value.length < 3)
			return 'Too short'
		if (value.length > 20)
			return 'Too long'
		return true
	})
```

#### Type Guards (Narrowing)

```ts
const isString = (value: unknown): value is string => typeof value === 'string'

const schema = v.unknown()
	.check(isString)

type T = v.Infer<typeof schema> // string
```

#### Cross-Property Validation

```ts
const passwordConfirm = v.object({
	password: v.string()
		.min(8),
	confirmPassword: v.string(),
})
	.check((obj) => {
		return obj.password === obj.confirmPassword || 'Passwords must match'
	})
```

#### Async Checks

```ts
const uniqueEmail = v.string()
	.check(async (value) => {
		const exists = await db.users.exists({ email: value })
		return !exists || 'Email already registered'
	})

const result = await uniqueEmail.execute('test@example.com')
```

### `fallback(getValue, message?)`

Provides a fallback value when validation fails. The failure is caught and replaced with the fallback.

```ts
const safeNumber = v.number()
	.min(0)
	.fallback(() => 0)

safeNumber.run(42) // { value: 42 }
safeNumber.run(-5) // { value: 0 }  (min failed, used fallback)
safeNumber.run('invalid') // { value: 0 }  (number failed, used fallback)
```

#### Dynamic Fallbacks

```ts
const schema = v.string()
	.parseJSON()
	.fallback(() => ({ items: [], count: 0 }))

schema.run('invalid json')
// { value: { items: [], count: 0 } }
```

#### Default Values for Optional Fields

```ts
const config = v.object({
	port: [v.number()
		.fallback(() => 3000)],
	host: [v.string()
		.fallback(() => 'localhost')],
})

config.run({})
// { value: { port: 3000, host: 'localhost' } }
```

### `transform(fn, message?)`

Transforms the value to a new type or shape.

```ts
const schema = v.string()
	.transform(value => value.split(','))

schema.run('a,b,c') // { value: ['a', 'b', 'c'] }

type T = v.Infer<typeof schema> // string[]
```

See [Transforms](/api/transforms) for detailed documentation.

## Schema Composition

### `use(schema)`

Delegates validation to another schema. Useful for reusing schemas and composing validations.

```ts
// Define reusable schemas
const stringSchema = v.string()
	.toTrimmed()
	.toLowercase()

const userSchema = v.object({
	name: v.unknown()
		.use(stringSchema),
	email: [v.unknown()
		.use(stringSchema)], // Optional
})

userSchema.run({
	name: '  ALICE  ',
})
// { value: { name: 'alice', email: undefined } }
```

#### Composing Unknown Input

```ts
const dataSchema = v.unknown()
	.use(v.object({
		type: v.literal('user'),
		payload: v.object({
			name: v.string(),
		}),
	}))
```

### `as<T>()`

Type assertion step for converting types without runtime transformation. Use with caution.

```ts
const schema = v.unknown()
	.as<string>()

// This doesn't validate at runtime - it only changes the type
type T = v.Infer<typeof schema> // string
```

## Message Handling

### Global Message Handler

Define a message resolver when creating the valchecker instance:

```ts
const v = createValchecker({
	steps: allSteps,
	message: ({ code, payload, path }) => {
		// Use your i18n library
		return i18n.t(`validation.${code}`, { ...payload, path: path.join('.') })
	},
})
```

### Message Resolution Priority

1. **Per-step message** (highest priority)
```ts
v.number()
	.min(1, 'Quantity must be at least 1')
```

2. **Global handler**
```ts
createValchecker({ steps, message: handler })
```

3. **Built-in fallback** (lowest priority)

### Dynamic Messages

```ts
const schema = v.number()
	.min(10, ({ payload }) =>
		`Value must be at least 10, got ${payload.value}`)
```

## Recursive Schemas

### `generic<T>(factory)`

Creates recursive/self-referential schemas with proper typing.

```ts
interface TreeNode {
	value: number
	children?: TreeNode[]
}

const treeSchema = v.object({
	value: v.number(),
	children: [v.array(
		v.generic<{ output: TreeNode }>(() => treeSchema)
	)], // Optional array of tree nodes
})

const result = treeSchema.run({
	value: 1,
	children: [
		{ value: 2 },
		{
			value: 3,
			children: [{ value: 4 }],
		},
	],
})
```

## Loose Variants

### `looseNumber(message?)`

Coerces strings to numbers before validation.

```ts
const schema = v.looseNumber()

schema.run('42') // { value: 42 }
schema.run(42) // { value: 42 }
schema.run('3.14') // { value: 3.14 }
schema.run('abc') // { issues: [...] }
```

### `looseObject(shape, message?)`

Alias for `object()` that explicitly allows unknown keys.

```ts
const schema = v.looseObject({
	name: v.string(),
})

schema.run({ name: 'Alice', extra: 'allowed' })
// { value: { name: 'Alice' } }
// Note: unknown keys are stripped from output
```

## Working with Results

### Result Type

```ts
type Result<T>
	= | { value: T }
		| { issues: Issue[] }

interface Issue {
	code: string
	message: string
	path: PropertyKey[]
	payload: unknown
}
```

### Handling Results

```ts
const result = schema.run(input)

if ('value' in result) {
	// Success: result.value is fully typed
	console.log(result.value)
}
else {
	// Failure: result.issues contains all errors
	for (const issue of result.issues) {
		console.log(`[${issue.code}] ${issue.path.join('.')}: ${issue.message}`)
	}
}
```

### Creating a Parse Function

```ts
function parse<T>(schema: Schema<T>, data: unknown): T {
	const result = schema.run(data)
	if ('issues' in result) {
		throw new ValidationError(result.issues)
	}
	return result.value
}

class ValidationError extends Error {
	constructor(public issues: Issue[]) {
		super(`Validation failed: ${issues.map(i => i.message)
			.join(', ')}`)
		this.name = 'ValidationError'
	}
}
```

### Safe Parse Pattern

```ts
function safeParse<T>(schema: Schema<T>, data: unknown): { success: true, data: T } | { success: false, error: Issue[] } {
	const result = schema.run(data)
	if ('value' in result) {
		return { success: true, data: result.value }
	}
	return { success: false, error: result.issues }
}
```

## Standard Schema Compliance

Valchecker implements Standard Schema V1, enabling interoperability:

```ts
import type { StandardSchema } from '@standard-schema/spec'

// All valchecker schemas are Standard Schema compatible
const userSchema: StandardSchema<User> = v.object({
	name: v.string(),
	email: v.string(),
})

// Use with any Standard Schema compatible library
```
