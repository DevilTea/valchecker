# Async Validation

Mix synchronous normalization and constraints with database or API checks in one pipeline.

## Username availability

```ts
import { v } from 'valchecker'

const usernameSchema = v.string()
	.toLowercase()
	.toTrimmed()
	.isLengthAtLeast(3, { message: 'Username must be at least 3 characters' })
	.isLengthAtMost(32, { message: 'Username must not exceed 32 characters' })
	.check(value => /^[a-z0-9_-]+$/.test(value), { message: 'Username can only contain lowercase letters, numbers, hyphens, and underscores' }
	)
	.check(async (value) => {
		const exists = await db.users.exists({ username: value })
		return exists ? 'Username is already taken' : true
	})
```

```ts
const result = await usernameSchema.execute('Alice_123')

if (v.isSuccess(result)) {
	console.log(`Username "${result.value}" is available`)
}
else {
	console.error(result.issues)
}
```

## Parallel external checks

A callback may perform independent work in parallel:

```ts
const emailSchema = v.string()
	.toLowercase()
	.toTrimmed()
	.isNotEmpty()
	.check(value => value.includes('@'), { message: 'Must be a valid email' })
	.check(async (value) => {
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

## Reached execution mode

A callback-driven schema can be maybe-async:

```ts
const schema = v.string().check(async value => value.length > 0)

schema.execute('value')
// Promise<ExecutionResult<string>> because the callback is reached

schema.execute(42)
// synchronous failure because string() fails before the callback
```

Use `.toAsync()` when every invocation must return a native promise:

```ts
const stableAsyncSchema = schema.toAsync()
const result = await stableAsyncSchema.execute(input)
```

## Thenable support

Callbacks may return supported `PromiseLike` values. Valchecker assimilates native promises, cross-realm promises, and custom thenables, normalizing public asynchronous completion to a native promise.

## Operational guidance

### Keep checks idempotent

```ts
const safe = v.string().check(async (value) => {
	const exists = await db.users.exists({ email: value })
	return exists ? 'Email already registered' : true
})
```

Do not use a validation callback as the only place that performs irreversible writes.

### Handle infrastructure failure deliberately

```ts
const schema = v.string().check(async (value) => {
	try {
		const exists = await db.users.exists({ username: value })
		return exists ? 'Username taken' : true
	}
	catch (error) {
		logger.error('Username availability check failed', error)
		return 'Unable to verify username availability'
	}
})
```

Decide whether infrastructure failure should reject validation, use a fallback, or propagate through an application-specific boundary.

### Cache only when semantics permit it

```ts
const cache = new Map<string, boolean>()

const schema = v.string().check(async (value) => {
	if (cache.has(value))
		return cache.get(value)! ? 'Email already exists' : true

	const exists = await db.users.exists({ email: value })
	cache.set(value, exists)
	return exists ? 'Email already exists' : true
})
```

Account for expiry and race conditions.

### Re-check uniqueness while writing

Validation does not replace database uniqueness constraints or transactional checks:

```ts
const result = await usernameSchema.execute(username)

if (v.isSuccess(result)) {
	await db.transaction(async (tx) => {
		const exists = await tx.users.exists({ username: result.value })
		if (exists)
			throw new Error('Username taken')

		await tx.users.create({ username: result.value })
	})
}
```