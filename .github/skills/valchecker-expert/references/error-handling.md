# Error Handling

Validation failures are returned as structured values rather than thrown validation exceptions.

## Result shape

```ts
type ExecutionResult<T, Issue>
	= | { value: T }
		| { issues: Issue[] }
```

Use the exported guards:

```ts
const result = await schema.execute(input)

if (v.isSuccess(result)) {
	const value = result.value
}
else {
	const issues = result.issues
}
```

## Issue shape

```ts
interface ExecutionIssue {
	code: string
	message: string
	path: PropertyKey[]
	payload: unknown
}
```

Representative codes:

```text
string:expected_string
number:expected_number
isFinite:expected_finite
isAtLeast:expected_at_least
isLengthAtLeast:expected_length_at_least
toJSONValue:invalid_json
```

Do not infer program behavior by parsing messages. Use `code`, `path`, and `payload`.

## Filtering by code

```ts
if (v.isFailure(result)) {
	const typeIssues = result.issues.filter(issue =>
		issue.code === 'string:expected_string'
		|| issue.code === 'number:expected_number',
	)

	const lowerBoundIssues = result.issues.filter(issue =>
		issue.code === 'isAtLeast:expected_at_least'
		|| issue.code === 'isLengthAtLeast:expected_length_at_least',
	)
}
```

## Grouping by path

```ts
function pathToField(path: PropertyKey[]) {
	return path
		.map((segment, index) =>
			typeof segment === 'number'
				? `[${segment}]`
				: index === 0
					? String(segment)
					: `.${String(segment)}`,
		)
		.join('')
}

const errorsByField = new Map<string, string[]>()

for (const issue of result.issues) {
	const field = pathToField(issue.path)
	const messages = errorsByField.get(field) ?? []
	messages.push(issue.message)
	errorsByField.set(field, messages)
}
```

Object keys and numeric array indexes are preserved as separate path segments. Symbol keys remain symbols.

## Custom messages

```ts
const age = v.number()
	.isFinite({ message: 'Age must be finite' })
	.isInteger({ message: 'Age must be a whole number' })
	.isAtLeast(0, { message: ({ payload }) =>
		`Age must be at least ${payload.minimum}` }
	)
	.isAtMost(150, { message: 'Age appears unrealistic' })
```

Message priority is:

1. per-step message,
2. global `createValchecker` resolver,
3. built-in default,
4. `"Invalid value."`.

## HTTP responses

```ts
if (v.isFailure(result)) {
	return Response.json({
		error: 'Validation failed',
		details: result.issues.map(issue => ({
			field: pathToField(issue.path),
			path: issue.path,
			code: issue.code,
			message: issue.message,
			payload: issue.payload,
		})),
	}, { status: 422 })
}
```

Avoid exposing sensitive payload values without review.

## Fallback recovery

`fallback()` recovers from any earlier failure in the same pipeline:

```ts
const port = v.looseNumber()
	.isFinite()
	.isInteger()
	.isAtLeast(1)
	.isAtMost(65535)
	.fallback(() => 3000)
```

The replacement becomes the current successful value. Validate it with later steps or `use()` when necessary.

## Async checks

```ts
const username = v.string().check(async (value) => {
	try {
		const exists = await db.users.exists({ username: value })
		return exists ? 'Username already exists' : true
	}
	catch (error) {
		logger.error('Username lookup failed', error)
		return 'Unable to verify username availability'
	}
})
```

Decide deliberately whether infrastructure failures should become validation issues, trigger fallback, or propagate as application errors.

A callback-driven schema may fail synchronously before asynchronous work is reached. Append `.toAsync()` when callers require an unconditional promise.

## Unexpected callback exceptions

Validation failures are values, but user code may still throw. Catch exceptions at the application boundary when callback or integration code can fail unexpectedly:

```ts
try {
	const result = await schema.execute(input)
	// handle success or issues
}
catch (error) {
	logger.error('Unexpected validation pipeline failure', error)
}
```

## Data normalization

Use concrete transformations for named operations and `transform()` for arbitrary output changes:

```ts
const schema = v.object({
	name: v.string()
		.toTrimmed()
		.isNotEmpty(),
	email: v.string()
		.toTrimmed()
		.toLowercase(),
	tags: v.array(v.string())
		.transform(values => [...new Set(values)]),
})
```

`use()` delegates to another schema; it does not accept a callback transformation.

## Testing

Test exact codes, payloads, paths, default messages, custom messages, and async early-failure behavior:

```ts
expect(result).toEqual({
	issues: [{
		code: 'isAtLeast:expected_at_least',
		message: 'Expected a value of at least 1.',
		path: ['quantity'],
		payload: {
			target: 'number',
			value: 0,
			minimum: 1,
		},
	}],
})
```

Nested validators clone issue objects when prepending paths, so frozen or reused child issues remain valid.