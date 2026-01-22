# Basic Validation

This example demonstrates fundamental validation patterns with Valchecker, covering primitives, objects, arrays, and common constraints.

## Setup

```ts
import { InferOutput } from '@valchecker/internal'
import { allSteps, createValchecker } from 'valchecker'

const v = createValchecker({ steps: allSteps })
```

## Primitive Validation

### Strings

```ts
import { InferOutput } from '@valchecker/internal'
// Basic string validation
const nameSchema = v.string()

nameSchema.execute('Alice') // { value: 'Alice' }
nameSchema.execute(123) // { issues: [...] }

// With constraints
const usernameSchema = v.string()
	.toTrimmed()
	.toLowercase()
	.min(3)
	.max(20)

usernameSchema.execute('  Alice_123  ')
// { value: 'alice_123' }
```

### Numbers

```ts
import { InferOutput } from '@valchecker/internal'
// Basic number validation
const ageSchema = v.number()
	.integer()
	.min(0)
	.max(150)

ageSchema.execute(25) // { value: 25 }
ageSchema.execute(-5) // { issues: [...] }
ageSchema.execute(3.14) // { issues: [...] }

// Positive numbers only
const priceSchema = v.number()
	.min(0)

priceSchema.execute(99.99) // { value: 99.99 }
priceSchema.execute(Number.POSITIVE_INFINITY) // { issues: [...] }
```

### Booleans

```ts
import { InferOutput } from '@valchecker/internal'

const activeSchema = v.boolean()

activeSchema.execute(true) // { value: true }
activeSchema.execute(false) // { value: false }
activeSchema.execute('yes') // { issues: [...] }
```

### Literals

```ts
import { InferOutput } from '@valchecker/internal'
// Single literal
const statusSchema = v.literal('active')

statusSchema.execute('active') // { value: 'active' }
statusSchema.execute('inactive') // { issues: [...] }

// Null and undefined
const nullSchema = v.literal(null)
const undefinedSchema = v.literal(undefined)
```

## Object Validation

### Basic Objects

```ts
import { InferOutput } from '@valchecker/internal'

const userSchema = v.object({
	id: v.string(),
	name: v.string()
		.min(1),
	email: v.string(),
	age: v.number()
		.integer()
		.min(0),
})

const result = userSchema.execute({
	id: '123e4567-e89b-12d3-a456-426614174000',
	name: 'Alice',
	email: 'alice@example.com',
	age: 30,
})

// { value: { id: '...', name: 'Alice', email: '...', age: 30 } }
```

### Optional Fields

```ts
import { InferOutput } from '@valchecker/internal'

const profileSchema = v.object({
	name: v.string(),
	bio: [v.string()], // string | undefined
	website: [v.string()], // string | undefined
})

// Both valid:
profileSchema.execute({ name: 'Alice' })
profileSchema.execute({ name: 'Alice', bio: 'Developer', website: 'https://alice.dev' })
```

### Nullable Fields

```ts
import { InferOutput } from '@valchecker/internal'

const settingsSchema = v.object({
	theme: v.string(),
	customColor: v.union([v.string(), v.literal(null)]), // string | null
})

settingsSchema.execute({ theme: 'dark', customColor: null }) // Valid
settingsSchema.execute({ theme: 'dark', customColor: '#fff' }) // Valid
```

### Nested Objects

```ts
import { InferOutput } from '@valchecker/internal'

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
import { InferOutput } from '@valchecker/internal'

const numbersSchema = v.array(v.number())

numbersSchema.execute([1, 2, 3]) // { value: [1, 2, 3] }
numbersSchema.execute([1, 'two', 3]) // { issues: [...] }
numbersSchema.execute('not array') // { issues: [...] }
```

### Array Constraints

```ts
import { InferOutput } from '@valchecker/internal'

const tagsSchema = v.array(v.string())
	.min(1) // At least one tag
	.max(10) // Maximum 10 tags

tagsSchema.execute(['javascript', 'typescript']) // Valid
tagsSchema.execute([]) // { issues: [...] }
```

### Array of Objects

```ts
import { InferOutput } from '@valchecker/internal'

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
import { InferOutput } from '@valchecker/internal'

const positiveNumbersSchema = v.array(v.number())
	.toFiltered(n => n > 0)

positiveNumbersSchema.execute([1, -2, 3, -4, 5])
// { value: [1, 3, 5] }
```

## Union Types

```ts
import { InferOutput } from '@valchecker/internal'
// String or number
const idSchema = v.union([
	v.string(),
	v.number()
		.integer()
		.min(1),
])

idSchema.execute('123e4567-e89b-12d3-a456-426614174000') // Valid
idSchema.execute(42) // Valid

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

eventSchema.execute({ type: 'click', x: 100, y: 200 }) // Valid
eventSchema.execute({ type: 'keypress', key: 'Enter' }) // Valid
```

## Enum Validation

```ts
import { InferOutput } from '@valchecker/internal'

const statusSchema = v.union([
	v.literal('pending'),
	v.literal('active'),
	v.literal('completed'),
	v.literal('cancelled'),
])

statusSchema.execute('active') // { value: 'active' }
statusSchema.execute('unknown') // { issues: [...] }

// Type inference
type Status = InferOutput<typeof statusSchema>
// 'pending' | 'active' | 'completed' | 'cancelled'
```

## Array Type Validation

```ts
import { InferOutput } from '@valchecker/internal'
// Specific array patterns can be validated using array with constraints
const coordinateSchema = v.array(v.number())
	.min(2)
	.max(2)

coordinateSchema.execute([10, 20]) // { value: [10, 20] }
coordinateSchema.execute([10]) // { issues: [...] }
coordinateSchema.execute([10, 20, 30]) // { issues: [...] }
```

## Type Inference

Valchecker automatically infers TypeScript types:

```ts
import { InferOutput } from '@valchecker/internal'

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
type User = InferOutput<typeof userSchema>
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
import { InferOutput } from '@valchecker/internal'

const schema = v.object({
	name: v.string()
		.min(1),
	age: v.number()
		.integer()
		.min(0),
})

const result = schema.execute({ name: '', age: -5 })

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
import { InferOutput } from '@valchecker/internal'
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
	const result = listUsersRequestSchema.execute(rawQuery)

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
