# Async Validation

Mix database lookups, API calls, and synchronous validation seamlessly in the same pipeline.

## Scenario: Username Availability Check

Validate username format and check availability against the database—all in one schema.

```ts
import { allSteps, createValchecker } from 'valchecker'

const v = createValchecker({ steps: allSteps })

const usernameSchema = v.string()
	.toLowercase()
	.toTrimmed()
	.min(3, 'Username must be at least 3 characters')
	.max(32, 'Username must not exceed 32 characters')
	.check(
		value => /^[a-z0-9_-]+$/.test(value),
		'Username can only contain lowercase letters, numbers, hyphens, and underscores',
	)
	.check(async (value) => {
		const exists = await db.users.exists({ username: value })
		return exists ? 'Username is already taken' : true
	})
```

### Usage

```ts
const result = await usernameSchema.execute('Alice_123')

if (v.isSuccess(result)) {
	console.log(`Username "${result.value}" is available`)
}
else {
	console.error('Validation failed:', result.issues[0].message)
}
```

## Scenario: Parallel API Validation

Validate email against multiple services in parallel.

```ts
const emailSchema = v.string()
	.toLowercase()
	.toTrimmed()
	.check(value => value.includes('@'), 'Must be a valid email')
	.check(async (value) => {
		// Both checks run in parallel
		const [isDisposable, isBanned] = await Promise.all([
			disposableEmailService.check(value),
			bannedEmailService.check(value),
		])

		if (isDisposable)
			return 'Disposable email addresses are not allowed'
		if (isBanned)
			return 'This email domain is not allowed'
		return true
	})
```

## Best Practices

### Idempotency

Async checks may run multiple times (e.g., during retries). Keep them idempotent:

```ts
// Good: Read-only check
const goodSchema = v.string()
	.check(async (value) => {
		const exists = await db.users.exists({ email: value })
		return exists ? 'Email already registered' : true
	})

// Bad: Side effects
const badSchema = v.string()
	.check(async (value) => {
		await db.logs.create({ action: 'email_check', value })
		return true
	})
```

### Error Handling

Handle network or database errors gracefully:

```ts
const schema = v.string()
	.check(async (value) => {
		try {
			const exists = await db.users.exists({ username: value })
			return exists ? 'Username taken' : true
		}
		catch (error) {
			// Log error but don't block validation
			logger.error('Username check failed', error)
			return true // Or return an error message
		}
	})
```

### Caching

Cache expensive async checks to avoid redundant API calls:

```ts
const cache = new Map<string, boolean>()

const emailSchema = v.string()
	.check(async (value) => {
		if (cache.has(value)) {
			return cache.get(value)!
		}

		const exists = await db.users.exists({ email: value })
		cache.set(value, exists)

		return exists ? 'Email already exists' : true
	})
```

### Race Conditions

When persisting validated data, combine validation with transactions:

```ts
// Validate first
const result = await usernameSchema.execute(username)

if (v.isSuccess(result)) {
	// Then persist within a transaction
	await db.transaction(async (tx) => {
		// Re-check existence within transaction
		const exists = await tx.users.exists({ username: result.value })
		if (exists)
			throw new Error('Username taken')

		await tx.users.create({ username: result.value })
	})
}
```

## Async Pipeline Behavior

Once any step returns a `Promise`, the entire pipeline becomes async:

```ts
const schema = v.string()
	.toTrimmed() // sync
	.check(async (v) => { // makes entire pipeline async
		return await validate(v)
	})
	.toLowercase() // still part of async chain

// Must await the result
const result = await schema.execute('INPUT')
```
