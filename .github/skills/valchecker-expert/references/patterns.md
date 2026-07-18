# Common Patterns

## Form validation

```ts
const form = v.object({
	email: v.string()
		.toTrimmed()
		.toLowercase()
		.isNotEmpty()
		.check(value => value.includes('@'), { message: 'Invalid email' }),
	password: v.string()
		.isLengthAtLeast(8)
		.check(value => /[A-Z]/.test(value), { message: 'Must contain uppercase' }),
	confirmation: v.string(),
}).check(value => value.password === value.confirmation, { message: 'Passwords must match' }
)
```

Map issue paths to form fields rather than parsing messages:

```ts
const errors: Record<string, string> = {}

for (const issue of result.issues) {
	const field = issue.path[0]
	if (typeof field === 'string')
		errors[field] ??= issue.message
}
```

## Query parameters

Query values often arrive as strings, so use loose primitives:

```ts
const query = v.object({
	page: v.looseNumber()
		.isFinite()
		.isInteger()
		.isAtLeast(1)
		.fallback(() => 1),
	limit: v.looseNumber()
		.isFinite()
		.isInteger()
		.isAtLeast(1)
		.isAtMost(100)
		.fallback(() => 20),
	includeArchived: [v.looseBoolean()],
	search: [v.string().toTrimmed()],
})
```

Loose primitives accept only their TypeScript-compatible representations, not arbitrary coercion.

## Request bodies

```ts
const createUser = v.object({
	name: v.string()
		.toTrimmed()
		.isNotEmpty()
		.isLengthAtMost(255),
	email: v.string()
		.toTrimmed()
		.toLowercase()
		.check(value => value.includes('@')),
	age: [v.number()
		.isFinite()
		.isInteger()
		.isAtLeast(0)],
})
```

Use `strictObject()` when unknown properties should be rejected, or `looseObject()` when they must be preserved.

## Configuration

```ts
const config = v.object({
	server: v.object({
		host: v.string().isNotEmpty(),
		port: v.looseNumber()
			.isFinite()
			.isInteger()
			.isAtLeast(1)
			.isAtMost(65535),
	}),
	pool: v.object({
		minimum: v.looseNumber().isFinite().isInteger().isAtLeast(1),
		maximum: v.looseNumber().isFinite().isInteger().isAtLeast(1),
	}),
})
```

Add a cross-property `check()` when maximum must be greater than minimum.

## JSON parsing and validation

```ts
const configFromJSON = v.string()
	.toJSONValue({ message: 'Invalid JSON' })
	.use(config)
```

`toJSONValue<T>()` can assert a parsed output type, but `use()` performs actual runtime structural validation.

## CSV-like input

```ts
const tags = v.string()
	.toSplit(',')
	.toFiltered(value => value.trim().length > 0)
	.transform(values => values.map(value => value.trim()))
	.isLengthAtMost(20)
```

After `toSplit()`, the output is already a string array; do not append another initial `array()` step.

## Collections

```ts
const orderItem = v.object({
	id: v.string().isNotEmpty(),
	quantity: v.number().isFinite().isInteger().isAtLeast(1),
	price: v.number().isFinite().isAtLeast(0),
})

const order = v.object({
	items: v.array(orderItem).isNotEmpty(),
	total: v.number().isFinite().isAtLeast(0),
})
```

Array transforms operate on transformed element outputs:

```ts
const sortedPositive = v.array(v.number().isFinite())
	.toFiltered(value => value > 0)
	.toSorted({ compareFn: (a, b) => a - b })
```

## Literal unions

```ts
const status = v.union([
	v.literal('draft'),
	v.literal('published'),
	v.literal('archived'),
])
```

For object variants, combine `object()` branches with literal discriminator fields.

## Reusable schemas

```ts
const email = v.string()
	.toTrimmed()
	.toLowercase()
	.check(value => value.includes('@'))

const contact = v.object({
	email,
	phone: [v.string()
		.toTrimmed()
		.check(value => /^\d{10,15}$/.test(value))],
})
```

Schemas are immutable and safe to reuse.

## Fallbacks

```ts
const theme = v.union([
	v.literal('light'),
	v.literal('dark'),
]).fallback(() => 'light' as const)
```

A fallback catches all earlier failures in its pipeline. Place it directly after the failures it is intended to recover and validate replacement output with subsequent steps when needed.

## Async checks

```ts
const uniqueEmail = email.check(async (value) => {
	const exists = await db.users.exists({ email: value })
	return exists ? 'Email already exists' : true
})
```

The schema may complete synchronously on an earlier failure. Add `.toAsync()` when callers require a stable promise return type.

## Performance

Construct reusable schemas once, use selective step registration in bundle-sensitive applications, and inspect the generated tree-shaking report when adding built-in plugins.