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

nameSchema.run('Alice') // { value: 'Alice' }
nameSchema.run(123) // { issues: [...] }

// With constraints
const usernameSchema = v.string()
	.toTrimmed()
	.toLowercase()
	.min(3)
	.max(20)

usernameSchema.run('  Alice_123  ')
// { value: 'alice_123' }
```

### Numbers

```ts
// Basic number validation
const ageSchema = v.number()
	.integer()
	.min(0)
	.max(150)

ageSchema.run(25) // { value: 25 }
ageSchema.run(-5) // { issues: [...] }
ageSchema.run(3.14) // { issues: [...] }

// Positive numbers only
const priceSchema = v.number()
	.min(0)

priceSchema.run(99.99) // { value: 99.99 }
priceSchema.run(Number.POSITIVE_INFINITY) // { issues: [...] }
```

### Booleans

```ts
const activeSchema = v.boolean()

activeSchema.run(true) // { value: true }
activeSchema.run(false) // { value: false }
activeSchema.run('yes') // { issues: [...] }
```

### Literals

```ts
// Single literal
const statusSchema = v.literal('active')

statusSchema.run('active') // { value: 'active' }
statusSchema.run('inactive') // { issues: [...] }

// Null and undefined
const nullSchema = v.literal(null)
const undefinedSchema = v.literal(undefined)
```

## Object Validation

### Basic Objects

```ts
const userSchema = v.object({
	id: v.string(),
	name: v.string()
		.min(1),
	email: v.string(),
	age: v.number()
		.integer()
		.min(0),
})

const result = userSchema.run({
	id: '123e4567-e89b-12d3-a456-426614174000',
	name: 'Alice',
	email: 'alice@example.com',
	age: 30,
})

// { value: { id: '...', name: 'Alice', email: '...', age: 30 } }
```

### Optional Fields

```ts
const profileSchema = v.object({
	name: v.string(),
	bio: [v.string()], // string | undefined
	website: [v.string()], // string | undefined
})

// Both valid:
profileSchema.run({ name: 'Alice' })
profileSchema.run({ name: 'Alice', bio: 'Developer', website: 'https://alice.dev' })
```

### Nullable Fields

```ts
const settingsSchema = v.object({
	theme: v.string(),
	customColor: v.union([v.string(), v.literal(null)]), // string | null
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
	zip: v.string(),
})

const customerSchema = v.object({
	name: v.string(),
	email: v.string(),
	shippingAddress: addressSchema,
	billingAddress: [addressSchema],
})
```

## Array Validation

### Basic Arrays

```ts
const numbersSchema = v.array(v.number())

numbersSchema.run([1, 2, 3]) // { value: [1, 2, 3] }
numbersSchema.run([1, 'two', 3]) // { issues: [...] }
numbersSchema.run('not array') // { issues: [...] }
```

### Array Constraints

```ts
const tagsSchema = v.array(v.string())
	.min(1) // At least one tag
	.max(10) // Maximum 10 tags

tagsSchema.run(['javascript', 'typescript']) // Valid
tagsSchema.run([]) // { issues: [...] }
```

### Array of Objects

```ts
const orderItemSchema = v.object({
	productId: v.string(),
	quantity: v.number()
		.integer()
		.min(1),
	price: v.number()
		.min(0),
})

const orderSchema = v.object({
	id: v.string(),
	items: v.array(orderItemSchema)
		.min(1),
	total: v.number()
		.min(0),
})
```

### Filtering Arrays

```ts
const positiveNumbersSchema = v.array(v.number())
	.toFiltered(n => n > 0)

positiveNumbersSchema.run([1, -2, 3, -4, 5])
// { value: [1, 3, 5] }
```

## Union Types

```ts
// String or number
const idSchema = v.union([
	v.string(),
	v.number()
		.integer()
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
const statusSchema = v.union([
	v.literal('pending'),
	v.literal('active'),
	v.literal('completed'),
	v.literal('cancelled'),
])

statusSchema.run('active') // { value: 'active' }
statusSchema.run('unknown') // { issues: [...] }

// Type inference
type Status = v.Infer<typeof statusSchema>
// 'pending' | 'active' | 'completed' | 'cancelled'
```

## Array Type Validation

```ts
// Specific array patterns can be validated using array with constraints
const coordinateSchema = v.array(v.number())
	.min(2)
	.max(2)

coordinateSchema.run([10, 20]) // { value: [10, 20] }
coordinateSchema.run([10]) // { issues: [...] }
coordinateSchema.run([10, 20, 30]) // { issues: [...] }
```

## Type Inference

Valchecker automatically infers TypeScript types:

```ts
const userSchema = v.object({
	id: v.number()
		.integer(),
	name: v.string(),
	email: v.string(),
	role: v.union([v.literal('admin'), v.literal('user'), v.literal('guest')]),
	tags: [v.array(v.string())],
	metadata: [v.object({})],
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
		.min(1),
	age: v.number()
		.integer()
		.min(0),
})

const result = schema.run({ name: '', age: -5 })

if ('value' in result) {
	// TypeScript knows result.value is the validated type
	console.log(result.value.name, result.value.age)
}
else {
	// Handle validation errors
	for (const issue of result.issues) {
		console.log(`[${issue.code}] ${issue.path.join('.')}: ${issue.message}`)
	}
	// [min:expected_min] name: Expected minimum value of 1
	// [min:expected_min] age: Expected minimum value of 0
}
```

## Complete Example: API Request Validation

```ts
// Define schemas
const paginationSchema = v.object({
	page: v.union([
		v.number()
			.integer()
			.min(1),
		v.literal(undefined),
	])
		.fallback(() => 1),
	limit: v.union([
		v.number()
			.integer()
			.min(1)
			.max(100),
		v.literal(undefined),
	])
		.fallback(() => 20),
})

const sortSchema = v.object({
	field: v.string(),
	order: v.union([
		v.literal('asc'),
		v.literal('desc'),
		v.literal(undefined),
	])
		.fallback(() => 'asc' as const),
})

const filterSchema = v.object({
	status: [v.union([v.literal('active'), v.literal('inactive'), v.literal('all')])],
	search: [v.string()
		.toTrimmed()],
	createdAfter: [v.string()],
})

const listUsersRequestSchema = v.object({
	pagination: [paginationSchema],
	sort: [sortSchema],
	filters: [filterSchema],
})

// Usage in API handler
function handleListUsers(rawQuery: unknown) {
	const result = listUsersRequestSchema.run(rawQuery)

	if ('issues' in result) {
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
