# Basic Validation

This example demonstrates fundamental validation patterns with Valchecker, covering primitives, objects, arrays, and common constraints.

## Setup

```ts
import { allSteps, createValchecker } from 'valchecker'

const v = createValchecker({ steps: allSteps })
```

## Primitive Validation

### Strings

```ts
// Basic string validation
const nameSchema = v.string()

nameSchema.run('Alice') // { isOk: true, value: 'Alice' }
nameSchema.run(123) // { isOk: false, issues: [...] }

// With constraints
const usernameSchema = v.string()
	.toTrimmed()
	.toLowercase()
	.minLength(3)
	.maxLength(20)
	.regex(/^[a-z0-9_]+$/, 'Only lowercase letters, numbers, and underscores')

usernameSchema.run('  Alice_123  ')
// { isOk: true, value: 'alice_123' }
```

### Numbers

```ts
// Basic number validation
const ageSchema = v.number()
	.int()
	.min(0)
	.max(150)

ageSchema.run(25) // { isOk: true, value: 25 }
ageSchema.run(-5) // { isOk: false, issues: [...] }
ageSchema.run(3.14) // { isOk: false, issues: [...] }

// Finite numbers only
const priceSchema = v.number()
	.finite()
	.min(0)

priceSchema.run(99.99) // { isOk: true, value: 99.99 }
priceSchema.run(Number.POSITIVE_INFINITY) // { isOk: false, issues: [...] }
```

### Booleans

```ts
const activeSchema = v.boolean()

activeSchema.run(true) // { isOk: true, value: true }
activeSchema.run(false) // { isOk: true, value: false }
activeSchema.run('yes') // { isOk: false, issues: [...] }
```

### Literals

```ts
// Single literal
const statusSchema = v.literal('active')

statusSchema.run('active') // { isOk: true, value: 'active' }
statusSchema.run('inactive') // { isOk: false, issues: [...] }

// Null and undefined
const nullSchema = v.literal(null)
const undefinedSchema = v.literal(undefined)
```

## Object Validation

### Basic Objects

```ts
const userSchema = v.object({
	id: v.string()
		.uuid(),
	name: v.string()
		.minLength(1),
	email: v.string()
		.email(),
	age: v.number()
		.int()
		.min(0),
})

const result = userSchema.run({
	id: '123e4567-e89b-12d3-a456-426614174000',
	name: 'Alice',
	email: 'alice@example.com',
	age: 30,
})

// { isOk: true, value: { id: '...', name: 'Alice', email: '...', age: 30 } }
```

### Optional Fields

```ts
const profileSchema = v.object({
	name: v.string(),
	bio: v.string()
		.optional(), // string | undefined
	website: v.string()
		.url()
		.optional(), // string | undefined
})

// Both valid:
profileSchema.run({ name: 'Alice' })
profileSchema.run({ name: 'Alice', bio: 'Developer', website: 'https://alice.dev' })
```

### Nullable Fields

```ts
const settingsSchema = v.object({
	theme: v.string(),
	customColor: v.string()
		.nullable(), // string | null
})

settingsSchema.run({ theme: 'dark', customColor: null }) // Valid
settingsSchema.run({ theme: 'dark', customColor: '#fff' }) // Valid
```

### Nested Objects

```ts
const addressSchema = v.object({
	street: v.string(),
	city: v.string(),
	country: v.string(),
	zip: v.string()
		.regex(/^\d{5}(-\d{4})?$/),
})

const customerSchema = v.object({
	name: v.string(),
	email: v.string()
		.email(),
	shippingAddress: addressSchema,
	billingAddress: addressSchema.optional(),
})
```

## Array Validation

### Basic Arrays

```ts
const numbersSchema = v.array(v.number())

numbersSchema.run([1, 2, 3]) // { isOk: true, value: [1, 2, 3] }
numbersSchema.run([1, 'two', 3]) // { isOk: false, issues: [...] }
numbersSchema.run('not array') // { isOk: false, issues: [...] }
```

### Array Constraints

```ts
const tagsSchema = v.array(v.string())
	.minLength(1) // At least one tag
	.maxLength(10) // Maximum 10 tags

tagsSchema.run(['javascript', 'typescript']) // Valid
tagsSchema.run([]) // { isOk: false, issues: [...] }
```

### Array of Objects

```ts
const orderItemSchema = v.object({
	productId: v.string(),
	quantity: v.number()
		.int()
		.min(1),
	price: v.number()
		.min(0),
})

const orderSchema = v.object({
	id: v.string(),
	items: v.array(orderItemSchema)
		.minLength(1),
	total: v.number()
		.min(0),
})
```

### Filtering Arrays

```ts
const positiveNumbersSchema = v.array(v.number())
	.toFiltered(n => n > 0)

positiveNumbersSchema.run([1, -2, 3, -4, 5])
// { isOk: true, value: [1, 3, 5] }
```

## Union Types

```ts
// String or number
const idSchema = v.union([
	v.string()
		.uuid(),
	v.number()
		.int()
		.min(1),
])

idSchema.run('123e4567-e89b-12d3-a456-426614174000') // Valid
idSchema.run(42) // Valid

// Discriminated union (recommended for objects)
const eventSchema = v.union([
	v.object({
		type: v.literal('click'),
		x: v.number(),
		y: v.number(),
	}),
	v.object({
		type: v.literal('keypress'),
		key: v.string(),
	}),
])

eventSchema.run({ type: 'click', x: 100, y: 200 }) // Valid
eventSchema.run({ type: 'keypress', key: 'Enter' }) // Valid
```

## Enum Validation

```ts
const statusSchema = v.enum(['pending', 'active', 'completed', 'cancelled'])

statusSchema.run('active') // { isOk: true, value: 'active' }
statusSchema.run('unknown') // { isOk: false, issues: [...] }

// Type inference
type Status = v.Infer<typeof statusSchema>
// 'pending' | 'active' | 'completed' | 'cancelled'
```

## Tuple Validation

```ts
// Fixed-length array with specific types
const coordinateSchema = v.tuple([v.number(), v.number()])

coordinateSchema.run([10, 20]) // { isOk: true, value: [10, 20] }
coordinateSchema.run([10]) // { isOk: false, issues: [...] }
coordinateSchema.run([10, 20, 30]) // { isOk: false, issues: [...] }

// Mixed types
const recordSchema = v.tuple([
	v.string(), // name
	v.number(), // age
	v.boolean(), // active
])

type Record = v.Infer<typeof recordSchema>
// [string, number, boolean]
```

## Type Inference

Valchecker automatically infers TypeScript types:

```ts
const userSchema = v.object({
	id: v.number()
		.int(),
	name: v.string(),
	email: v.string()
		.email(),
	role: v.enum(['admin', 'user', 'guest']),
	tags: v.array(v.string())
		.optional(),
	metadata: v.record(v.string(), v.unknown())
		.optional(),
})

// Automatically inferred type
type User = v.Infer<typeof userSchema>
// {
//   id: number
//   name: string
//   email: string
//   role: 'admin' | 'user' | 'guest'
//   tags?: string[] | undefined
//   metadata?: Record<string, unknown> | undefined
// }
```

## Working with Results

```ts
const schema = v.object({
	name: v.string()
		.minLength(1),
	age: v.number()
		.int()
		.min(0),
})

const result = schema.run({ name: '', age: -5 })

if (result.isOk) {
	// TypeScript knows result.value is the validated type
	console.log(result.value.name, result.value.age)
}
else {
	// Handle validation errors
	for (const issue of result.issues) {
		console.log(`[${issue.code}] ${issue.path.join('.')}: ${issue.message}`)
	}
	// [minLength:expected_min_length] name: Expected minimum length of 1
	// [min:expected_min] age: Expected minimum value of 0
}
```

## Complete Example: API Request Validation

```ts
// Define schemas
const paginationSchema = v.object({
	page: v.number()
		.int()
		.min(1)
		.optional()
		.fallback(() => 1),
	limit: v.number()
		.int()
		.min(1)
		.max(100)
		.optional()
		.fallback(() => 20),
})

const sortSchema = v.object({
	field: v.string(),
	order: v.enum(['asc', 'desc'])
		.optional()
		.fallback(() => 'asc' as const),
})

const filterSchema = v.object({
	status: v.enum(['active', 'inactive', 'all'])
		.optional(),
	search: v.string()
		.toTrimmed()
		.optional(),
	createdAfter: v.string()
		.datetime()
		.optional(),
})

const listUsersRequestSchema = v.object({
	pagination: paginationSchema.optional()
		.fallback(() => ({ page: 1, limit: 20 })),
	sort: sortSchema.optional(),
	filters: filterSchema.optional(),
})

// Usage in API handler
function handleListUsers(rawQuery: unknown) {
	const result = listUsersRequestSchema.run(rawQuery)

	if (!result.isOk) {
		return { error: 'Invalid request', issues: result.issues }
	}

	const { pagination, sort, filters } = result.value
	// pagination is guaranteed to have page and limit
	// sort and filters are optional but typed when present

	return fetchUsers({ pagination, sort, filters })
}
```

## Next Steps

- [Async Validation](/examples/async-validation) - Database checks and API calls
- [Custom Messages](/examples/custom-messages) - Internationalization and custom errors
- [Fallback Chains](/examples/fallback-chains) - Resilient validation pipelines
- [Issue Paths](/examples/issue-paths) - Error location tracking
