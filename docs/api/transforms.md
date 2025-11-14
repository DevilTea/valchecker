# Transforms

Transform steps reshape data without leaving the validation pipeline. They can be chained between validation steps and support both synchronous and asynchronous operations.

## String Transforms

### `toUppercase()`

Converts string to uppercase.

```ts
const schema = v.string()
	.toUppercase()

schema.execute('hello') // { value: 'HELLO' }
```

### `toLowercase()`

Converts string to lowercase.

```ts
const email = v.string()
	.toLowercase()

schema.execute('USER@EXAMPLE.COM') // { value: 'user@example.com' }
```

### `toTrimmed()`

Trims whitespace from both ends.

```ts
const schema = v.string()
	.toTrimmed()

schema.execute('  hello  ') // { value: 'hello' }
```

### `toTrimmedStart()` / `toTrimmedEnd()`

Trim whitespace from one side only.

```ts
const schema = v.string()
	.toTrimmedStart()

schema.execute('  hello  ') // { value: 'hello  ' }
```

## String Validators with Transform Behavior

### `startsWith(prefix, message?)`

Validates that string starts with prefix.

**Issue Code**: `'startsWith:expected_starts_with'`

```ts
const schema = v.string()
	.startsWith('https://')

schema.execute('https://example.com') // { value: 'https://example.com' }
```

### `endsWith(suffix, message?)`

Validates that string ends with suffix.

**Issue Code**: `'endsWith:expected_ends_with'`

### `min(length, message?)` / `max(length, message?)`

Validates string length constraints.

**Issue Codes**: `'min:expected_min'`, `'max:expected_max'`

```ts
const username = v.string()
	.min(3)
	.max(20)
```

## Array Transforms

### `toSorted(compareFn?)`

Returns a sorted copy of the array.

```ts
const schema = v.array(v.number())
	.toSorted()

schema.execute([3, 1, 2]) // { value: [1, 2, 3] }
```

### `toFiltered(predicate)`

Keeps only elements that satisfy the predicate.

```ts
const schema = v.array(v.number())
	.toFiltered(n => n > 0)

schema.execute([1, -2, 3, -4]) // { value: [1, 3] }
```

### `toSliced(start, end?)`

Returns a slice of the array.

```ts
const schema = v.array(v.string())
	.toSliced(0, 10)

schema.execute(['a', 'b', 'c',])
// { value: first 10 items }
```

### `toLength()`

Replaces the array with its length.

```ts
const schema = v.array(v.string())
	.toLength()

schema.execute(['a', 'b', 'c']) // { value: 3 }
```

## JSON Transforms

### `parseJSON(message?)`

Parses a JSON string into an object.

**Issue Code**: `'parseJSON:invalid_json'`

```ts
const schema = v.string()
	.parseJSON()

schema.execute('{"key":"value"}')
// { value: { key: 'value' } }

schema.execute('invalid json')
// { issues: [{ code: 'json:invalid_json', ... }] }
```

### `stringifyJSON(message?)`

Serializes an object to JSON string.

**Issue Code**: `'stringifyJSON:unserializable'`

```ts
const schema = v.object({ key: v.string() })
	.stringifyJSON()

schema.execute({ key: 'value' })
// { value: '{"key":"value"}' }
```

## Custom Transform

### `transform(fn, message?)`

Apply a custom transformation function.

```ts
const slug = v.string()
	.toLowercase()
	.transform(value => value.replace(/[^a-z0-9-]+/g, '-'))

slug.execute('Hello World!')
// { value: 'hello-world-' }
```

**Async transforms**:

```ts
const schema = v.string()
	.transform(async (value) => {
		const result = await someAsyncOperation(value)
		return result.normalized
	})

const result = await schema.execute('input')
```

## Number Transforms

### `toString()`

Converts number to string.

```ts
const schema = v.number()
	.toString()

schema.execute(123) // { value: '123' }
```

### `integer(message?)`

Validates that number is an integer.

**Issue Code**: `'integer:expected_integer'`

```ts
const schema = v.number()
	.integer()

schema.execute(42) // { value: 42 }
schema.execute(42.5) // { issues: [{ code: 'integer:expected_integer', ... }] }
```

## Async Pipeline Behavior

When any transform returns a `Promise`, the entire pipeline becomes async:

```ts
const schema = v.string()
	.toTrimmed() // sync
	.transform(async (v) => { // makes pipeline async
		return await normalize(v)
	})
	.toLowercase() // still part of async chain

const result = await schema.execute('INPUT')
```

Valchecker preserves execution order even across async boundaries.
