# Fallback Chains

Use `fallback()` to build resilient validation pipelines that gracefully handle malformed data without throwing errors.

## Scenario: Parsing JSON Payloads

Handle invalid JSON gracefully by falling back to a default structure.

```ts
import { allSteps, createValchecker } from 'valchecker'

const v = createValchecker({ steps: allSteps })

const payloadSchema = v.string()
	.parseJSON('Invalid JSON format')
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
			),
		}),
	)
```

### Usage

```ts
// Valid JSON
const result1 = await payloadSchema.execute(
	'{"items":[{"id":"123","quantity":5}]}',
)
// { value: { items: [{ id: '123', quantity: 5 }] } }

// Invalid JSON → fallback to default
const result2 = await payloadSchema.execute('not valid json')
// { value: { items: [] } }

// Valid JSON but missing items → fallback
const result3 = await payloadSchema.execute('{"other":"data"}')
// { value: { items: [] } }
```

## Scenario: Missing Configuration Values

Provide sensible defaults for optional configuration.

```ts
const configSchema = v.object({
	port: v.number()
		.integer()
		.min(1)
		.max(65535)
		.fallback(() => 3000),
	host: v.string()
		.fallback(() => 'localhost'),
	timeout: v.number()
		.integer()
		.min(0)
		.fallback(() => 30000),
})

const result = configSchema.execute({
	port: 'invalid', // Falls back to 3000
	// host is missing → falls back to 'localhost'
	timeout: 5000, // Valid, no fallback needed
})

// result.value === { port: 3000, host: 'localhost', timeout: 5000 }
```

## Scenario: Form Input Sanitization

Normalize user input with fallback chains for robust form handling.

```ts
const phoneSchema = v.string()
	.toTrimmed()
	.transform(value => value.replace(/\D/g, '')) // Remove non-digits
	.check(value => value.length >= 10, 'Phone number too short')
	.fallback(() => '') // Fall back to empty string if invalid

const emailSchema = v.string()
	.toTrimmed()
	.toLowercase()
	.check(value => value.includes('@'), 'Invalid email format')
	.fallback(() => null) // Fall back to null if invalid

const formSchema = v.object({
	name: v.string()
		.toTrimmed()
		.fallback(() => 'Anonymous'),
	phone: phoneSchema,
	email: [emailSchema], // Optional field
})
```

## Scenario: Multi-Stage Parsing

Chain multiple fallbacks for complex data transformation.

```ts
const dateSchema = v.unknown()
	// Try parsing as ISO string
	.transform((value) => {
		if (typeof value === 'string') {
			const date = new Date(value)
			if (!Number.isNaN(date.getTime()))
				return date
		}
		throw new Error('Not a valid date string')
	})
	.fallback(() => {
		// Try parsing as timestamp
		return (value) => {
			if (typeof value === 'number') {
				return new Date(value)
			}
			throw new Error('Not a timestamp')
		}
	})
	.fallback(() => new Date()) // Finally, use current date

const result1 = dateSchema.execute('2024-01-15')
// { value: Date object for 2024-01-15 }

const result2 = dateSchema.execute(1705276800000)
// { value: Date object from timestamp }

const result3 = dateSchema.execute('invalid')
// { value: Date object for current time }
```

## Scenario: External API Fallbacks

Fall back to cached or default data when API calls fail.

```ts
const enrichUserSchema = v.object({
	id: v.string(),
	name: v.string(),
})
	.transform(async (user) => {
		try {
			const details = await api.getUserDetails(user.id)
			return { ...user, ...details }
		}
		catch (error) {
			throw new Error('API call failed')
		}
	})
	.fallback(() => {
		// Fallback to cached or default data when API fails
		return {
			avatar: '/default-avatar.png',
			role: 'user',
		}
	})
```

## Dynamic Fallback Values

Access the validation issues in fallback functions to make informed decisions.

```ts
const schema = v.number()
	.min(0)
	.fallback((issues) => {
		console.log('Fallback triggered, issues:', issues.length)
		return 0
	})

const result = schema.execute(-5)
// Logs: "Fallback triggered, issues: 1"
// result.value === 0
```

## Multiple Fallbacks

Chain multiple fallbacks for progressive error recovery.

```ts
const schema = v.string()
	.parseJSON('Step 1: Invalid JSON')
	.fallback(() => {
		console.log('Fallback 1: Returning empty object')
		return {}
	})
	.check(value => value.items !== undefined, 'Step 2: Missing items')
	.fallback(() => {
		console.log('Fallback 2: Adding empty items array')
		return { items: [] }
	})

const result = schema.execute('not json')
// Logs: "Fallback 1: Returning empty object"
// Logs: "Fallback 2: Adding empty items array"
// result.value === { items: [] }
```

## Best Practices

### Use Fallbacks Sparingly

Fallbacks are powerful but can hide data quality issues. Use them for:
- User input sanitization
- Optional configuration values
- External API failures
- Avoid masking critical validation errors

### Log Fallback Triggers

Monitor when fallbacks are used to detect upstream data quality problems:

```ts
const schema = v.number()
	.fallback((issues) => {
		logger.warn('Number validation failed, using fallback', { issues })
		return 0
	})
```

### Document Fallback Behavior

Make fallback values explicit and predictable:

```ts
// Clear intent
const timeout = v.number()
	.integer()
	.min(1000)
	.fallback(() => 30000) // Default: 30 second timeout

// Unclear
const timeout = v.number()
	.fallback(() => 30000)
```

### Combine with Monitoring

Track fallback usage in production:

```ts
const schema = v.number()
	.fallback((issues) => {
		metrics.increment('validation.fallback.number', {
			issues_count: issues.length,
		})
		return 0
	})
```
