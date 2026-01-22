# Structures

Structural validators orchestrate nested validation pipelines and maintain proper issue paths for complex data shapes.

## `object(shape, message?)`

Validates an object with specified properties. Unknown keys are allowed by default (see `strictObject()` for strict mode).

**Parameters**:
- `shape`: Object mapping keys to schemas
- Properties can be wrapped in `[]` to make them optional
- `message`: Custom error message or handler

**Issue Codes**:
- `'object:expected_object'`: Value is not an object or is an array/null
- Plus any issues from nested property validators

```ts
const user = v.object({
	id: v.string(),
	name: v.string()
		.toTrimmed(),
	age: [v.number()
		.min(0)], // Optional
})

user.run({ id: '123', name: '  Alice  ' })
// { value: { id: '123', name: 'Alice', age: undefined } }

user.run({ id: '123', name: '  Alice  ', extra: 'ignored' })
// { value: { id: '123', name: 'Alice', age: undefined } }
// Note: 'extra' is stripped from output
```

### Type Inference

```ts
type User = v.Infer<typeof user>
// { id: string; name: string; age: number | undefined }
```

## `strictObject(shape, message?)`

Like `object()` but rejects unknown keys.

**Issue Codes**:
- `'object:expected_object'`: Value is not an object
- `'object:unknown_key'`: Object contains keys not in shape

```ts
const strict = v.strictObject({
	id: v.string(),
})

strict.run({ id: '123', extra: 'not allowed' })
// { issues: [{ code: 'object:unknown_key', ... }] }

strict.run({ id: '123' })
// { value: { id: '123' } }
```

## `looseObject(shape, message?)`

Alias for `object()`. Explicitly allows unknown keys while validating declared properties.

## `array(elementSchema, message?)`

Validates each element of an array with the provided schema.

**Issue Codes**:
- `'array:expected_array'`: Value is not an array
- Plus any issues from element validators (with index in path)

```ts
const tags = v.array(v.string()
	.toLowercase())
	.min(1)
	.max(5)

tags.run(['JS', 'TS', 'NODE'])
// { value: ['js', 'ts', 'node'] }

tags.run(['a', 123, 'c'])
// { issues: [{ path: [1], code: 'string:expected_string', ... }] }

tags.run([])
// { issues: [{ code: 'min:expected_min', ... }] }
```

**Chainable Methods**:
- `min(count)` - Minimum array length
- `max(count)` - Maximum array length
- `toFiltered(predicate)` - Filter elements
- `toSorted(compareFn?)` - Sort array
- `toSliced(start, end?)` - Slice array
- `toLength()` - Replace array with its length (number)

## `union(schemas, message?)`

Tries each schema in order, returns the first success. Fails only if all schemas fail.

**Issue Code**: Union itself doesn't produce issues; you see issues from branches if all fail

```ts
const id = v.union([
	v.string()
		.toTrimmed(),
	v.number()
		.integer()
		.min(0),
])

id.run('abc') // { value: 'abc' }
id.run(123) // { value: 123 }
id.run(true) // { issues: [from first branch, from second branch] }

type ID = v.Infer<typeof id>
// string | number
```

### Discriminated Unions

For objects with a discriminator field:

```ts
const event = v.union([
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

type Event = v.Infer<typeof event>
// | { type: 'click'; x: number; y: number }
// | { type: 'keypress'; key: string }
```

## `intersection(schemas, message?)`

Runs all schemas and merges their results. All schemas must pass.

```ts
const timestamped = v.object({
	createdAt: v.number(),
	updatedAt: v.number(),
})

const auditable = v.object({
	createdBy: v.string(),
	updatedBy: v.string(),
})

const entity = v.intersection([timestamped, auditable])

entity.run({
	createdAt: 1234567890,
	updatedAt: 1234567890,
	createdBy: 'alice',
	updatedBy: 'bob',
})
// { value: { createdAt: ..., updatedAt: ..., createdBy: ..., updatedBy: ... } }

type Entity = v.Infer<typeof entity>
// { createdAt: number; updatedAt: number; createdBy: string; updatedBy: string }
```

## `instance(constructor, message?)`

Validates that a value is an instance of the given constructor.

**Issue Code**: `'instance:expected_instance'`

```ts
const dateSchema = v.instance(Date)

dateSchema.run(new Date()) // { value: Date }
dateSchema.run('2024-01-01') // { issues: [...] }

// Custom classes
class User {
	constructor(public name: string) {}
}

const userInstance = v.instance(User)
userInstance.run(new User('Alice')) // { value: User { name: 'Alice' } }

// Built-in types
const regexSchema = v.instance(RegExp)
const errorSchema = v.instance(Error)
const mapSchema = v.instance(Map)
```

## Nested Issue Paths

Structural validators automatically prepend keys or indexes to issue paths:

```ts
const schema = v.object({
	users: v.array(
		v.object({
			profile: v.object({
				name: v.string(),
			}),
		}),
	),
})

schema.run({
	users: [
		{ profile: { name: 'Alice' } },
		{ profile: { name: 123 } }, // ← Invalid
	],
})
// issues[0].path === ['users', 1, 'profile', 'name']
```

This makes it easy to:
- Highlight exact failing fields in forms
- Map errors to UI components
- Generate human-readable error locations

## Combining Structures

Structures can be freely nested and combined:

```ts
const addressSchema = v.object({
	street: v.string(),
	city: v.string(),
	zip: v.string(),
})

const companySchema = v.object({
	name: v.string(),
	addresses: v.array(addressSchema)
		.min(1),
	contacts: v.object({
		primary: v.string(),
		backup: [v.string()],
	}),
})

const orderSchema = v.object({
	id: v.string(),
	company: companySchema,
	items: v.array(
		v.object({
			productId: v.string(),
			quantity: v.number()
				.integer()
				.min(1),
			price: v.number()
				.min(0),
		})
	),
	shippingAddress: addressSchema,
	billingAddress: [addressSchema], // Optional
})
```
