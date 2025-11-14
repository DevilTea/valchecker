# Structures

Structural validators orchestrate nested validation pipelines and maintain proper issue paths for complex data shapes.

## `object(shape, message?)`

Validates an object with specified properties. Unknown keys are allowed by default.

**Parameters**:
- `shape`: Object mapping keys to schemas. Wrap schema in `[]` for optional properties.
- `message`: Custom error message or handler

**Issue Codes**:
- `'object:expected_object'`: Value is not an object
- Plus any issues from nested property validators

```ts
const user = v.object({
	id: v.string(),
	name: v.string()
		.toTrimmed(),
	age: [v.number()
		.min(0)], // Optional property
})

user.execute({ id: '123', name: '  Alice  ' })
// { value: { id: '123', name: 'Alice', age: undefined } }
```

## `strictObject(shape, message?)`

Like `object()` but rejects unknown keys.

```ts
const strict = v.strictObject({
	id: v.string(),
})

strict.execute({ id: '123', extra: 'not allowed' })
// { issues: [{ code: 'object:unknown_key', ... }] }
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

tags.execute(['JS', 'TS', 'NODE'])
// { value: ['js', 'ts', 'node'] }

tags.execute(['a', 123, 'c'])
// { issues: [{ path: [1], code: 'string:expected_string', ... }] }
```

**Chainable Methods**:
- `min(count)` - Minimum array length
- `max(count)` - Maximum array length
- `toFiltered(predicate)` - Filter elements
- `toSorted(compareFn?)` - Sort array
- `toSliced(start, end?)` - Slice array
- `toLength()` - Replace array with its length (number)

## `union(schemas, message?)`

Tries each schema in order, returning the first success.

**Issue Code**: `'union:no_match'` when all branches fail

```ts
const id = v.union([
	v.string()
		.toTrimmed(),
	v.number()
		.integer()
		.min(0),
])

id.execute('abc') // { value: 'abc' }
id.execute(123) // { value: 123 }
id.execute(true) // { issues: [{ code: 'union:no_match', ... }] }
```

## `intersection(schemas, message?)`

Runs all schemas and merges their results.

```ts
const auditable = v.object({ createdAt: v.number() })
const softDelete = v.object({ deletedAt: [v.number()] })

const entity = v.intersection([auditable, softDelete])

entity.execute({ createdAt: 1234567890 })
// { value: { createdAt: 1234567890, deletedAt: undefined } }
```

## `instance(constructor, message?)`

Validates that a value is an instance of the given constructor.

**Issue Code**: `'instance:expected_instance'`

```ts
const dateSchema = v.instance(Date)

dateSchema.execute(new Date())
// { value: Date instance }

dateSchema.execute('2024-01-01')
// { issues: [{ code: 'instance:expected_instance', ... }] }
```

Useful for:
- `Date` objects
- Custom class instances
- Built-in types like `Map`, `Set`, `RegExp`

## Nested Issue Paths

Structural validators automatically prepend keys or indexes to issue paths:

```ts
const schema = v.object({
	items: v.array(
		v.object({
			id: v.string(),
		}),
	),
})

schema.execute({ items: [{ id: 123 }] })
// issues[0].path === ['items', 0, 'id']
```

This makes it easy to highlight the exact failing field in forms or API responses.
