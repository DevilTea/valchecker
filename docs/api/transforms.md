# Transforms

Transform steps reshape data without leaving the validation pipeline. They can be chained between validation steps and support both synchronous and asynchronous operations.

## String Transforms

### `toTrimmed()`

Trims whitespace from both ends.

```ts
const schema = v.string().toTrimmed()

schema.run('  hello  ') // { isOk: true, value: 'hello' }
```

### `toTrimmedStart()`

Trims whitespace from the beginning.

```ts
const schema = v.string().toTrimmedStart()

schema.run('  hello  ') // { isOk: true, value: 'hello  ' }
```

### `toTrimmedEnd()`

Trims whitespace from the end.

```ts
const schema = v.string().toTrimmedEnd()

schema.run('  hello  ') // { isOk: true, value: '  hello' }
```

### `toUppercase()`

Converts string to uppercase.

```ts
const schema = v.string().toUppercase()

schema.run('hello') // { isOk: true, value: 'HELLO' }
```

### `toLowercase()`

Converts string to lowercase.

```ts
const email = v.string().toLowercase()

email.run('USER@EXAMPLE.COM') // { isOk: true, value: 'user@example.com' }
```

## String Constraint Steps

### `startsWith(prefix, message?)`

Validates that string starts with prefix.

**Issue Code**: `'startsWith:expected_starts_with'`

```ts
const schema = v.string().startsWith('https://')

schema.run('https://example.com') // { isOk: true, value: 'https://example.com' }
schema.run('http://example.com')  // { isOk: false, issues: [...] }
```

### `endsWith(suffix, message?)`

Validates that string ends with suffix.

**Issue Code**: `'endsWith:expected_ends_with'`

```ts
const schema = v.string().endsWith('.json')

schema.run('config.json') // { isOk: true, value: 'config.json' }
schema.run('config.yaml') // { isOk: false, issues: [...] }
```

### `min(length, message?)` / `max(length, message?)`

Validates string length constraints. These are separate steps that validate the length property.

**Issue Codes**: `'min:expected_min'`, `'max:expected_max'`

```ts
const username = v.string()
  .min(3, 'Username too short')
  .max(20, 'Username too long')

username.run('ab')                     // { isOk: false, issues: [...] }
username.run('alice')                  // { isOk: true, value: 'alice' }
username.run('a'.repeat(21))          // { isOk: false, issues: [...] }
```

## Array Transforms

### `toFiltered(predicate)`

Keeps only elements that satisfy the predicate.

```ts
const positives = v.array(v.number()).toFiltered(n => n > 0)

positives.run([1, -2, 3, -4, 5]) // { isOk: true, value: [1, 3, 5] }
```

### `toSorted(compareFn?)`

Returns a sorted copy of the array.

```ts
// Default sort (string comparison)
const schema = v.array(v.number()).toSorted()

schema.run([3, 1, 2]) // { isOk: true, value: [1, 2, 3] }

// Custom comparator
const descending = v.array(v.number()).toSorted((a, b) => b - a)

descending.run([1, 3, 2]) // { isOk: true, value: [3, 2, 1] }
```

### `toSliced(start, end?)`

Returns a slice of the array.

```ts
const firstThree = v.array(v.string()).toSliced(0, 3)

firstThree.run(['a', 'b', 'c', 'd', 'e']) // { isOk: true, value: ['a', 'b', 'c'] }

// Negative indices work too
const lastTwo = v.array(v.string()).toSliced(-2)

lastTwo.run(['a', 'b', 'c', 'd', 'e']) // { isOk: true, value: ['d', 'e'] }
```

### `toLength()`

Replaces the array with its length.

```ts
const schema = v.array(v.string()).toLength()

schema.run(['a', 'b', 'c']) // { isOk: true, value: 3 }

type T = v.Infer<typeof schema>  // number
```

### `toSplitted(separator)`

Splits a string using the provided separator.

```ts
const schema = v.string().toSplitted(',')

schema.run('a,b,c') // { isOk: true, value: ['a', 'b', 'c'] }
```

## JSON Transforms

### `parseJSON(message?)`

Parses a JSON string into a value.

**Issue Code**: `'parseJSON:invalid_json'`

```ts
const schema = v.string().parseJSON()

schema.run('{"key":"value"}')
// { isOk: true, value: { key: 'value' } }

schema.run('invalid json')
// { isOk: false, issues: [{ code: 'parseJSON:invalid_json', ... }] }

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
const schema = v.object({ key: v.string() }).stringifyJSON()

schema.run({ key: 'value' })
// { isOk: true, value: '{"key":"value"}' }
```

## Number Transforms

### `toString()`

Converts number to string.

```ts
const schema = v.number().toString()

schema.run(123) // { isOk: true, value: '123' }

type T = v.Infer<typeof schema>  // string
```

## Custom Transform

### `transform(fn, message?)`

Apply a custom transformation function. The function can be sync or async.

**Sync Transform**:

```ts
const slug = v.string()
  .toLowercase()
  .transform(value => value.replace(/[^a-z0-9-]+/g, '-'))

slug.run('Hello World!')
// { isOk: true, value: 'hello-world-' }
```

**Type-Changing Transform**:

```ts
const splitTags = v.string()
  .transform(value => value.split(',').map(s => s.trim()))

type T = v.Infer<typeof splitTags>  // string[]

splitTags.run('js, ts, node')
// { isOk: true, value: ['js', 'ts', 'node'] }
```

**Async Transform**:

```ts
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
const safeParseInt = v.string()
  .transform((value) => {
    const num = parseInt(value, 10)
    if (isNaN(num)) {
      throw new Error('Invalid integer')
    }
    return num
  })
```

## Object Transforms

### Extending Objects

Use `transform` to add computed properties:

```ts
const userWithAge = v.object({
  name: v.string(),
  birthYear: v.number().int(),
}).transform(user => ({
  ...user,
  age: new Date().getFullYear() - user.birthYear,
}))

type T = v.Infer<typeof userWithAge>
// { name: string; birthYear: number; age: number }
```

### Picking/Omitting Properties

```ts
const fullUser = v.object({
  id: v.string(),
  name: v.string(),
  email: v.string(),
  password: v.string(),
})

const publicUser = fullUser.transform(({ password, ...rest }) => rest)

type T = v.Infer<typeof publicUser>
// { id: string; name: string; email: string }
```

## Forcing Async Execution

### `toAsync()`

Converts a sync or maybe-async schema into an async schema, ensuring all execution happens asynchronously.

```ts
const schema = v.string()
  .transform(x => x.toUpperCase())
  .toAsync()

const result = await schema.execute('hello')
// result.value: 'HELLO'
```

## Chaining Transforms

Transforms can be chained to build complex pipelines:

```ts
const processedData = v.string()
  .toTrimmed()                           // " hello, world " → "hello, world"
  .toLowercase()                         // "Hello, World" → "hello, world"
  .transform(s => s.split(','))         // "hello,world" → ["hello", "world"]
  .transform(arr => arr.map(s => s.trim()))  // ["hello", " world"] → ["hello", "world"]
  .transform(arr => arr.filter(s => s.length > 0))  // Filter empty strings
```

## Async Pipeline Behavior

When any transform returns a `Promise`, the entire pipeline becomes async:

```ts
const schema = v.string()
  .toTrimmed()                    // sync
  .transform(async (v) => {       // makes pipeline async
    return await normalize(v)
  })
  .toLowercase()                  // still part of async chain

// Must use await
const result = await schema.execute('INPUT')

// Or with run()
const result = await schema.run('INPUT')  // Returns Promise
```

Valchecker preserves execution order even across async boundaries.

## Transform vs Check

Use `transform` when you need to change the value. Use `check` when you only need to validate:

```ts
// Transform: changes the value
const trimmed = v.string().transform(s => s.trim())

// Check: validates without changing
const nonEmpty = v.string().check(s => s.length > 0)

// Combined
const validName = v.string()
  .transform(s => s.trim())      // Change: trim whitespace
  .check(s => s.length > 0)      // Validate: not empty
  .check(s => /^[a-zA-Z]+$/.test(s))  // Validate: only letters
```
