# Transforms

Concrete transformation steps use the `toXxx` prefix and replace the successful pipeline value with a transformed output. The generic `transform()` escape hatch keeps its direct name.

## String transforms

### `toTrimmed()`

Trims whitespace from both ends.

```ts
v.string().toTrimmed().execute('  hello  ')
// { value: 'hello' }
```

### `toTrimmedStart()`

Trims whitespace from the beginning.

### `toTrimmedEnd()`

Trims whitespace from the end.

### `toUppercase()`

Converts a string to uppercase.

### `toLowercase()`

Converts a string to lowercase.

```ts
v.string().toLowercase().execute('USER@EXAMPLE.COM')
// { value: 'user@example.com' }
```

### `toSplit(separator, limit?)`

Delegates to `String.prototype.split` and outputs a string array.

```ts
v.string().toSplit(',').execute('a,b,c')
// { value: ['a', 'b', 'c'] }

v.string().toSplit(',', 2).execute('a,b,c')
// { value: ['a', 'b'] }
```

## Array transforms

### `toFiltered(predicate)`

Keeps elements accepted by the predicate.

```ts
v.array(v.number())
	.toFiltered(value => value > 0)
	.execute([1, -2, 3])
// { value: [1, 3] }
```

### `toSorted(compare?)`

Returns a sorted array output.

```ts
v.array(v.number())
	.toSorted((a, b) => a - b)
	.execute([3, 1, 2])
// { value: [1, 2, 3] }
```

### `toSliced(start, end?)`

Returns a sliced output and forwards the arguments to the current value's `slice` method.

### `toLength()`

Replaces a length-bearing value with its numeric length.

```ts
v.array(v.string()).toLength().execute(['a', 'b'])
// { value: 2 }
```

## JSON transforms

### `toJSONValue<T = unknown>(message?)`

Parses a JSON string with `JSON.parse`.

**Issue code:** `toJSONValue:invalid_json`

```ts
const schema = v.string()
	.toJSONValue<{ port: number }>()

schema.execute('{"port":8080}')
// { value: { port: 8080 } }

schema.execute('invalid')
// failure with toJSONValue:invalid_json
```

The generic type parameter is an output assertion; use `use()` after parsing when the parsed structure must also be validated:

```ts
const config = v.string()
	.toJSONValue()
	.use(v.object({
		port: v.number().isFinite().isInteger(),
	}))
```

### `toJSONString(message?)`

Serializes a supported value with `JSON.stringify`.

**Issue code:** `toJSONString:unserializable`

```ts
v.object({ key: v.string() })
	.toJSONString()
	.execute({ key: 'value' })
// { value: '{"key":"value"}' }
```

Unsupported values and circular structures produce an issue instead of escaping the validation result as an exception.

## General conversion

### `toString()`

Converts a supported value to a string.

```ts
v.number().toString().execute(123)
// { value: '123' }
```

## Generic transform

### `transform(fn)`

`transform()` remains the high-level escape hatch for arbitrary output changes. The callback may return a direct value or a supported asynchronous result according to the step contract.

```ts
const slug = v.string()
	.toTrimmed()
	.toLowercase()
	.transform(value => value.replace(/[^a-z0-9-]+/g, '-'))
```

Type-changing transforms flow into subsequent state-aware methods:

```ts
const tags = v.string()
	.toSplit(',')
	.toFiltered(value => value.length > 0)
```

## Forcing native promise output

### `toAsync()`

Forces every invocation of the complete schema to return a native `Promise`.

```ts
const schema = v.string()
	.toUppercase()
	.toAsync()

const result = await schema.execute('hello')
```

`toAsync()` changes execution mode, not the successful value.

## Transform versus validation

Use a transformation when the successful output changes. Use a validation when the original successful value is preserved:

```ts
const name = v.string()
	.toTrimmed()
	.isNotEmpty()
	.toLowercase()
```

Use `transform()` and `check()` only when no built-in named step expresses the operation precisely.