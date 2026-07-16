# Issue Paths

Every validation issue contains a `path: PropertyKey[]` identifying the nested value that failed.

## Nested objects

```ts
const schema = v.object({
	user: v.object({
		profile: v.object({
			email: v.string()
				.check(value => value.includes('@')),
		}),
	}),
})

const result = schema.execute({
	user: {
		profile: {
			email: 'invalid',
		},
	},
})
```

The `check:failed` issue receives:

```ts
['user', 'profile', 'email']
```

## Array indices

Array indices are numeric path segments:

```ts
const order = v.object({
	items: v.array(
		v.object({
			id: v.string(),
			price: v.number()
				.isFinite()
				.isAtLeast(0),
		}),
	),
})

const result = order.execute({
	items: [
		{ id: 'a', price: 10 },
		{ id: 'b', price: -5 },
	],
})
```

The second item's constraint issue receives:

```ts
['items', 1, 'price']
```

Its code is `isAtLeast:expected_at_least` and its payload includes the failing value and minimum.

## Multiple issues

Each failure retains its own path:

```ts
const users = v.object({
	users: v.array(
		v.object({
			email: v.string(),
			age: v.number(),
		}),
	),
})
```

For input containing wrong types in multiple records, issues may include:

```ts
{ path: ['users', 0, 'email'], code: 'string:expected_string' }
{ path: ['users', 0, 'age'], code: 'number:expected_number' }
{ path: ['users', 2, 'email'], code: 'string:expected_string' }
```

## Form field mapping

```ts
const form = v.object({
	personalInfo: v.object({
		firstName: v.string().isNotEmpty(),
		lastName: v.string().isNotEmpty(),
	}),
	contact: v.object({
		email: v.string()
			.check(value => value.includes('@')),
		phone: v.string()
			.isLengthAtLeast(10),
	}),
})
```

Convert a path to the naming convention used by the form library:

```ts
function toFieldName(path: PropertyKey[]) {
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
```

Examples:

```ts
toFieldName(['contact', 'email']) // contact.email
toFieldName(['items', 1, 'price']) // items[1].price
```

## HTTP responses

Preserve both the path array and a rendered field identifier:

```ts
if (v.isFailure(result)) {
	return Response.json({
		error: 'Validation failed',
		details: result.issues.map(issue => ({
			path: issue.path,
			field: toFieldName(issue.path),
			code: issue.code,
			message: issue.message,
			payload: issue.payload,
		})),
	}, { status: 422 })
}
```

Clients can localize by code and highlight by path without parsing human-readable messages.

## Grouping by path

```ts
const byField = new Map<string, typeof result.issues>()

for (const issue of result.issues) {
	const field = toFieldName(issue.path)
	const list = byField.get(field)
	if (list)
		list.push(issue)
	else
		byField.set(field, [issue])
}
```

## Path semantics

- Object properties add their property key.
- Array elements add their numeric index.
- Symbol keys remain symbols.
- A root-level issue has an empty path.
- Nested validators prepend paths by creating new issue objects rather than mutating child issues.
- Frozen or reused child issues are therefore supported.

Custom step authors should return issue paths relative to the value handled by their step. Parent object, array, union, and delegation steps apply outer path segments according to their contract.