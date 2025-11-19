# Issue Paths

Structured paths make it easy to pinpoint exactly which field failed validation in nested data structures.

## Understanding Issue Paths

Every validation issue includes a `path` array describing how to reach the failing value:

```ts
const schema = v.object({
	user: v.object({
		email: v.string(),
	}),
})

const result = schema.execute({
	user: {
		email: 123, // Invalid: should be string
	},
})

// result.issues[0].path === ['user', 'email']
// result.issues[0].code === 'string:expected_string'
```

## Nested Objects

Paths automatically track object property access:

```ts
const profileSchema = v.object({
	user: v.object({
		profile: v.object({
			contacts: v.object({
				email: v.string()
					.check(v => v.includes('@')),
			}),
		}),
	}),
})

const result = profileSchema.execute({
	user: {
		profile: {
			contacts: {
				email: 'invalid-email', // Missing @
			},
		},
	},
})

// result.issues[0].path === ['user', 'profile', 'contacts', 'email']
```

## Array Indexes

Paths include array indexes as numbers:

```ts
const schema = v.object({
	items: v.array(
		v.object({
			id: v.string(),
			price: v.number()
				.min(0),
		}),
	),
})

const result = schema.execute({
	items: [
		{ id: 'a', price: 10 },
		{ id: 'b', price: -5 }, // Invalid: negative price
		{ id: 'c', price: 15 },
	],
})

// result.issues[0].path === ['items', 1, 'price']
// Index 1 corresponds to the second item
```

## Multiple Errors

Each error gets its own path:

```ts
const schema = v.object({
	users: v.array(
		v.object({
			email: v.string(),
			age: v.number(),
		}),
	),
})

const result = schema.execute({
	users: [
		{ email: 123, age: 'twenty' }, // Two errors
		{ email: 'test@example.com', age: 25 }, // Valid
		{ email: true, age: null }, // Two errors
	],
})

// result.issues will include:
// { path: ['users', 0, 'email'], code: 'string:expected_string' }
// { path: ['users', 0, 'age'], code: 'number:expected_number' }
// { path: ['users', 2, 'email'], code: 'string:expected_string' }
// { path: ['users', 2, 'age'], code: 'number:expected_number' }
```

## Form Field Highlighting

Map paths to form fields for UI feedback:

```ts
const formSchema = v.object({
	personalInfo: v.object({
		firstName: v.string()
			.min(1),
		lastName: v.string()
			.min(1),
	}),
	contact: v.object({
		email: v.string()
			.check(v => v.includes('@')),
		phone: v.string()
			.min(10),
	}),
})

const result = await formSchema.execute(formData)

if (v.isFailure(result)) {
	// Convert paths to dot-notation for field lookup
	const errors = result.issues.map(issue => ({
		field: issue.path.join('.'),
		message: issue.message,
	}))

	// errors:
	// [
	//   { field: 'personalInfo.firstName', message: '...' },
	//   { field: 'contact.email', message: '...' },
	// ]

	// Highlight each field
	for (const { field, message } of errors) {
		highlightField(field, message)
	}
}
```

## API Error Responses

Include paths in HTTP error responses:

```ts
const result = await requestSchema.execute(req.body)

if (v.isFailure(result)) {
	return res.status(422)
		.json({
			error: 'Validation failed',
			details: result.issues.map(issue => ({
				path: issue.path,
				field: issue.path.join('.'),
				message: issue.message,
				code: issue.code,
			})),
		})
}

// Response:
// {
//   "error": "Validation failed",
//   "details": [
//     {
//       "path": ["user", "profile", "age"],
//       "field": "user.profile.age",
//       "message": "Age must be at least 0",
//       "code": "min:expected_min"
//     }
//   ]
// }
```

## Grouping Errors by Path

Aggregate multiple errors for the same field:

```ts
const result = await schema.execute(data)

if (v.isFailure(result)) {
	const errorsByField = new Map<string, string[]>()

	for (const issue of result.issues) {
		const field = issue.path.join('.')
		if (!errorsByField.has(field)) {
			errorsByField.set(field, [])
		}
		errorsByField.get(field)!.push(issue.message)
	}

	// errorsByField:
	// Map {
	//   'email' => ['Must be a valid email', 'Email already exists'],
	//   'password' => ['Must be at least 8 characters']
	// }
}
```

## Custom Path Manipulation

When building custom steps with `implStepPlugin`, manage paths manually:

```ts
import type { DefineStepMethod, TStepPluginDef } from '@valchecker/internal'
import { implStepPlugin } from '@valchecker/internal'

interface PluginDef extends TStepPluginDef {
	// dynamicObject: DefineStepMethod</* ... */>
	dynamicObject: DefineStepMethod<any>
}

export const dynamicObject = implStepPlugin<PluginDef>({
	dynamicObject: ({ utils: { addSuccessStep, success, failure, prependIssuePath } }) => {
		addSuccessStep((value) => {
			const issues: ExecutionIssue[] = []

			for (const [key, entry] of Object.entries(value)) {
				if (!isValid(entry)) {
					// Prepend current key to issue path
					issues.push(
						prependIssuePath(
							{
								code: 'dynamic:invalid_entry',
								path: [key], // New path segment
								message: `Invalid entry: ${key}`,
								payload: { key, entry },
							},
							[], // Base path (will be prepended by parent steps)
						),
					)
				}
			}

			return issues.length > 0 ? failure(issues) : success(value)
		})
	},
})
```

## Best Practices

### Use Paths for Field Mapping

Convert paths to your UI's field naming convention:

```ts
// Convert ['user', 'profile', 'email'] to 'user_profile_email'
const fieldId = issue.path.join('_')

// Or use bracket notation for arrays:
// ['items', 0, 'name'] → 'items[0].name'
const fieldPath = issue.path
	.map((segment, i) =>
		typeof segment === 'number' ? `[${segment}]` : i === 0 ? segment : `.${segment}`,
	)
	.join('')
```

### Keep Paths Minimal

Avoid deeply nested schemas when possible. Flatter structures produce cleaner paths.

### Document Path Structure

When building APIs, document the expected path format for clients:

```ts
/**
 * Validation errors include a `path` array:
 * - Object properties: ['user', 'email']
 * - Array indexes: ['items', 0, 'name']
 * - Nested: ['data', 'users', 1, 'profile', 'age']
 */
```
