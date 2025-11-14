# Helpers & Utilities

Helper methods control validation flow, compose schemas, and inspect execution results.

## Flow Control

### `check(predicate, message?)`

Runs a custom validation predicate or type guard.

**Issue Code**: `'check:failed'`

**Basic validation**:

```ts
const positive = v.number()
	.check(value => value > 0, 'Must be positive')

positive.execute(5) // { value: 5 }
positive.execute(-1) // { issues: [{ code: 'check:failed', message: 'Must be positive' }] }
```

**Type guards** (narrows TypeScript type):

```ts
const isString = (value: unknown): value is string => typeof value === 'string'

const schema = v.unknown()
	.check(isString)

// TypeScript now knows the output is string
```

**Return values**:
- `true`: Validation passes
- `false`: Validation fails with default/custom message
- `string`: Validation fails with that string as the message
- `narrow<T>()`: Type guard helper to narrow TypeScript type

**Advanced: Manual issue management**:

```ts
const schema = v.object({
	prop1: v.string(),
})
	.check((obj, { addIssue }) => {
		// Custom cross-property validation with custom paths
		if (obj.prop1.length < 5) {
			addIssue({
				code: 'custom:prop1_too_short',
				path: ['prop1'],
				payload: { value: obj.prop1 },
				message: 'prop1 must be at least 5 characters long',
			})
		}
	})
```

**Async checks**:

```ts
const schema = v.string()
	.check(async (value) => {
		const isValid = await validateWithAPI(value)
		return isValid || 'API validation failed'
	})
```

### `transform(fn, message?)`

Transforms the value to a new type or shape.

```ts
const schema = v.string()
	.transform(value => value.split(','))

schema.execute('a,b,c') // { value: ['a', 'b', 'c'] }
```

**Async transforms**:

```ts
const enriched = v.object({ id: v.string() })
	.transform(async (value) => {
		const details = await db.fetch(value.id)
		return { ...value, ...details }
	})
```

### `fallback(getValue, message?)`

Provides a fallback value when validation fails.

```ts
const safeNumber = v.number()
	.fallback(() => 0)

safeNumber.execute(42) // { value: 42 }
safeNumber.execute('invalid') // { value: 0 }
```

**Dynamic fallbacks**:

```ts
const schema = v.string()
	.parseJSON()
	.fallback(() => ({ items: [] }))

schema.execute('invalid json')
// { value: { items: [] } }
```

### `use(schema)`

Delegates validation to another schema.

```ts
// Define reusable email schema
const emailSchema = v.string()
	.toLowercase()
	.toTrimmed()
	.check(x => x.includes('@'))

// Use it in other schemas
const userSchema = v.object({
	email: v.unknown()
		.use(emailSchema),
	name: v.string(),
})

userSchema.execute({
	email: '  TEST@EXAMPLE.COM  ',
	name: 'Alice',
})
// { value: { email: 'test@example.com', name: 'Alice' } }
```

Perfect for:
- Reusable validation patterns
- Extracting common schemas
- Avoiding duplication

## Type Utilities

### `isSuccess(result)`

Type guard that narrows result to success.

```ts
const result = schema.execute(input)

if (v.isSuccess(result)) {
	// TypeScript knows: result is { value: T }
	console.log(result.value)
}
```

### `isFailure(result)`

Type guard that narrows result to failure.

```ts
const result = schema.execute(input)

if (v.isFailure(result)) {
	// TypeScript knows: result is { issues: ExecutionIssue[] }
	console.error(result.issues)
}
```

## Message Handler

### Global Message Handler

Define a translator when creating the valchecker instance:

```ts
const v = createValchecker({
	steps: allSteps,
	message: ({ code, payload, path }) => {
		// Centralized translation logic
		return translate(code, payload, path)
	},
})
```

**Message resolution priority**:

1. Per-step message (highest priority)
2. Global handler
3. Built-in fallback (lowest priority)

```ts
// Per-step override takes precedence
const schema = v.number()
	.min(1, 'Quantity must be at least 1')
```

## Advanced Composition

### `generic<T>(stepOrFactory)`

Adds type-safe recursion for self-referential schemas.

```ts
interface TreeNode {
	id: number
	children?: TreeNode[]
}

const nodeSchema = v.object({
	id: v.number(),
	children: [v.array(
		v.generic<{ output: TreeNode }>((): any => nodeSchema),
	)],
})

const result = nodeSchema.execute({
	id: 1,
	children: [
		{ id: 2 },
		{ id: 3, children: [{ id: 4 }] },
	],
})
```

## Loose Variants

### `looseNumber(message?)`

Coerces strings to numbers before validation.

```ts
const schema = v.looseNumber()

schema.execute('42') // { value: 42 }
schema.execute(42) // { value: 42 }
schema.execute('abc') // { issues: [{ code: 'number:expected_number', ... }] }
```

### `looseObject(shape, message?)`

Alias for `object()` that explicitly allows unknown keys.
