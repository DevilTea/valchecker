# Transforms

Transform steps reshape data without leaving the validation pipeline. They can be chained between validation steps and support both synchronous and asynchronous operations.

## String Transforms

### `toTrimmed()`

Trims whitespace from both ends.

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.string()
	.toTrimmed()

schema.execute('  hello  ') // { value: 'hello' }
```

### `toTrimmedStart()`

Trims whitespace from the beginning.

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.string()
	.toTrimmedStart()

schema.execute('  hello  ') // { value: 'hello  ' }
```

### `toTrimmedEnd()`

Trims whitespace from the end.

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.string()
	.toTrimmedEnd()

schema.execute('  hello  ') // { value: '  hello' }
```

### `toUppercase()`

Converts string to uppercase.

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.string()
	.toUppercase()

schema.execute('hello') // { value: 'HELLO' }
```

### `toLowercase()`

Converts string to lowercase.

```ts
import { InferOutput } from '@valchecker/internal'

const email = v.string()
	.toLowercase()

email.execute('USER@EXAMPLE.COM') // { value: 'user@example.com' }
```

## String Constraint Steps

### `startsWith(prefix, message?)`

Validates that string starts with prefix.

**Issue Code**: `'startsWith:expected_starts_with'`

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.string()
	.startsWith('https://')

schema.execute('https://example.com') // { value: 'https://example.com' }
schema.execute('http://example.com') // { issues: [...] }
```

### `endsWith(suffix, message?)`

Validates that string ends with suffix.

**Issue Code**: `'endsWith:expected_ends_with'`

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.string()
	.endsWith('.json')

schema.execute('config.json') // { value: 'config.json' }
schema.execute('config.yaml') // { issues: [...] }
```

### `min(length, message?)` / `max(length, message?)`

Validates string length constraints. These are separate steps that validate the length property.

**Issue Codes**: `'min:expected_min'`, `'max:expected_max'`

```ts
import { InferOutput } from '@valchecker/internal'

const username = v.string()
	.min(3, 'Username too short')
	.max(20, 'Username too long')

username.execute('ab') // { issues: [...] }
username.execute('alice') // { value: 'alice' }
username.execute('a'.repeat(21)) // { issues: [...] }
```

## Array Transforms

### `toFiltered(predicate)`

Keeps only elements that satisfy the predicate.

```ts
import { InferOutput } from '@valchecker/internal'

const positives = v.array(v.number())
	.toFiltered(n => n > 0)

positives.execute([1, -2, 3, -4, 5]) // { value: [1, 3, 5] }
```

### `toSorted(compareFn?)`

Returns a sorted copy of the array.

```ts
import { InferOutput } from '@valchecker/internal'
// Default sort (string comparison)
const schema = v.array(v.number())
	.toSorted()

schema.execute([3, 1, 2]) // { value: [1, 2, 3] }

// Custom comparator
const descending = v.array(v.number())
	.toSorted((a, b) => b - a)

descending.execute([1, 3, 2]) // { value: [3, 2, 1] }
```

### `toSliced(start, end?)`

Returns a slice of the array.

```ts
import { InferOutput } from '@valchecker/internal'

const firstThree = v.array(v.string())
	.toSliced(0, 3)

firstThree.execute(['a', 'b', 'c', 'd', 'e']) // { value: ['a', 'b', 'c'] }

// Negative indices work too
const lastTwo = v.array(v.string())
	.toSliced(-2)

lastTwo.execute(['a', 'b', 'c', 'd', 'e']) // { value: ['d', 'e'] }
```

### `toLength()`

Replaces the array with its length.

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.array(v.string())
	.toLength()

schema.execute(['a', 'b', 'c']) // { value: 3 }

type T = InferOutput<typeof schema> // number
```

### `toSplitted(separator)`

Splits a string using the provided separator.

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.string()
	.toSplitted(',')

schema.execute('a,b,c') // { value: ['a', 'b', 'c'] }
```

## JSON Transforms

### `parseJSON(message?)`

Parses a JSON string into a value.

**Issue Code**: `'parseJSON:invalid_json'`

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.string()
	.parseJSON()

schema.execute('{"key":"value"}')
// { value: { key: 'value' } }

schema.execute('invalid json')
// { issues: [{ code: 'parseJSON:invalid_json', ... }] }

// Chain with further validation
const userJson = v.string()
	.parseJSON()
	.use(v.object({
		name: v.string(),
		age: v.number(),
	}))
```

### `stringifyJSON(message?)`

Serializes a value to JSON string.

**Issue Code**: `'stringifyJSON:unserializable'`

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.object({ key: v.string() })
	.stringifyJSON()

schema.execute({ key: 'value' })
// { value: '{"key":"value"}' }
```

## Number Transforms

### `toString()`

Converts number to string.

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.number()
	.toString()

schema.execute(123) // { value: '123' }

type T = InferOutput<typeof schema> // string
```

## Custom Transform

### `transform(fn, message?)`

Apply a custom transformation function. The function can be sync or async.

**Sync Transform**:

```ts
import { InferOutput } from '@valchecker/internal'

const slug = v.string()
	.toLowercase()
	.transform(value => value.replace(/[^a-z0-9-]+/g, '-'))

slug.execute('Hello World!')
// { value: 'hello-world-' }
```

**Type-Changing Transform**:

```ts
import { InferOutput } from '@valchecker/internal'

const splitTags = v.string()
	.transform(value => value.split(',')
		.map(s => s.trim()))

type T = InferOutput<typeof splitTags> // string[]

splitTags.execute('js, ts, node')
// { value: ['js', 'ts', 'node'] }
```

**Async Transform**:

```ts
import { InferOutput } from '@valchecker/internal'

const enriched = v.object({ id: v.string() })
	.transform(async (value) => {
		const details = await db.fetchDetails(value.id)
		return { ...value, ...details }
	})

const result = await enriched.execute({ id: '123' })
```

**Transform with Validation**:

Transforms can fail by throwing or returning a failure:

```ts
import { InferOutput } from '@valchecker/internal'

const safeParseInt = v.string()
	.transform((value) => {
		const num = Number.parseInt(value, 10)
		if (Number.isNaN(num)) {
			throw new TypeError('Invalid integer')
		}
		return num
	})
```

## Object Transforms

### Extending Objects

Use `transform` to add computed properties:

```ts
import { InferOutput } from '@valchecker/internal'

const userWithAge = v.object({
	name: v.string(),
	birthYear: v.number()
		.integer(),
})
	.transform(user => ({
		...user,
		age: new Date()
			.getFullYear() - user.birthYear,
	}))

type T = InferOutput<typeof userWithAge>
// { name: string; birthYear: number; age: number }
```

### Picking/Omitting Properties

```ts
import { InferOutput } from '@valchecker/internal'

const fullUser = v.object({
	id: v.string(),
	name: v.string(),
	email: v.string(),
	password: v.string(),
})

const publicUser = fullUser.transform(({ password, ...rest }) => rest)

type T = InferOutput<typeof publicUser>
// { id: string; name: string; email: string }
```

## Forcing Async Execution

### `toAsync()`

Converts a sync or maybe-async schema into an async schema, ensuring all execution happens asynchronously.

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.string()
	.transform(x => x.toUpperCase())
	.toAsync()

const result = await schema.execute('hello')
// result.value: 'HELLO'
```

## Chaining Transforms

Transforms can be chained to build complex pipelines:

```ts
import { InferOutput } from '@valchecker/internal'

const processedData = v.string()
	.toTrimmed() // " hello, world " → "hello, world"
	.toLowercase() // "Hello, World" → "hello, world"
	.transform(s => s.split(',')) // "hello,world" → ["hello", "world"]
	.transform(arr => arr.map(s => s.trim())) // ["hello", " world"] → ["hello", "world"]
	.transform(arr => arr.filter(s => s.length > 0)) // Filter empty strings
```

## Async Pipeline Behavior

When any transform returns a `Promise`, the entire pipeline becomes async:

```ts
import { InferOutput } from '@valchecker/internal'

const schema = v.string()
	.toTrimmed() // sync
	.transform(async (v) => { // makes pipeline async
		return await normalize(v)
	})
	.toLowercase() // still part of async chain

// Must use await
const result = await schema.execute('INPUT')

// Or with run()
const result = await schema.execute('INPUT') // Returns Promise
```

Valchecker preserves execution order even across async boundaries.

## Transform vs Check

Use `transform` when you need to change the value. Use `check` when you only need to validate:

```ts
import { InferOutput } from '@valchecker/internal'
// Transform: changes the value
const trimmed = v.string()
	.transform(s => s.trim())

// Check: validates without changing
const nonEmpty = v.string()
	.check(s => s.length > 0)

// Combined
const validName = v.string()
	.transform(s => s.trim()) // Change: trim whitespace
	.check(s => s.length > 0) // Validate: not empty
	.check(s => /^[a-z]+$/i.test(s)) // Validate: only letters
```
