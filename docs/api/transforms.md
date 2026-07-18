# Transforms

Concrete transformation steps use the `toXxx` prefix and replace the successful pipeline value. The generic `transform()` escape hatch keeps its direct name.

Message-bearing transformations use a trailing options object.

## String transforms

### `toTrimmed()`, `toTrimmedStart()`, and `toTrimmedEnd()`

Trim whitespace from both ends, the beginning, or the end.

### `toUppercase()` and `toLowercase()`

Convert a string to uppercase or lowercase.

### `toNormalized(options?)`

Normalizes a string with `String.prototype.normalize`. `form` may be `NFC`, `NFD`, `NFKC`, or `NFKD`; the default is `NFC`.

This pure transformation does not emit an issue. An unsupported form supplied by a JavaScript caller is rejected while constructing the schema.

```ts
v.string()
	.toNormalized({ form: 'NFC' })
	.execute('e\u0301')
// { value: 'é' }
```

### `toSplit(separator, limit?)`

Delegates to `String.prototype.split` and outputs a string array.

```ts
v.string()
	.toSplit(',', 2)
	.execute('a,b,c')
// { value: ['a', 'b'] }
```

## Array transforms

### `toFiltered(predicate, options?)`

Keeps elements accepted by the predicate. Type-guard predicates narrow the output element type. Optional `thisArg` and `message` belong to the options object.

**Issue code:** `toFiltered:callback_failed` (`operation`)

Failure payload: `{ value, item, index, error }`.

### `toMapped(mapper, options?)`

Maps each item without mutating the input. The mapper receives `(item, index, value)` and optional `thisArg`.

Mapper return values are preserved exactly. A returned promise remains an array item and does not make the step asynchronous.

Mapper exceptions emit an operation issue. Errors thrown by the underlying array `map` operation outside the mapper remain core internal failures.

**Issue code:** `toMapped:callback_failed` (`operation`)

Failure payload: `{ value, item, index, error }`.

```ts
v.array(v.number())
	.toMapped((value, index) => value + index)
	.execute([1, 2])
// { value: [1, 3] }
```

### `toSorted(options?)`

Returns a sorted array without mutating the input. Supply `compareFn` and `message` in the options object.

**Issue code:** `toSorted:callback_failed` (`operation`)

Failure payload: `{ value, left, right, error }`.

### `toSliced(start, end?)`

Forwards arguments to the current value's `slice` method.

### `toLength()`

Replaces a length-bearing value with its numeric length.

## Collection transforms

### `toSize()`

Replaces a size-bearing value such as a Map or Set with its numeric size. This pure transformation emits no issue.

```ts
v.set(v.string())
	.toSize()
	.execute(new Set(['a', 'b']))
// { value: 2 }
```

### `toArray()`

Replaces a Set with a new item array in insertion order.

```ts
v.set(v.string())
	.toArray()
	.execute(new Set(['b', 'a']))
// { value: ['b', 'a'] }
```

### `toKeys()`, `toValues()`, and `toEntries()`

Replace a Map with a new array of its keys, values, or mutable `[key, value]` tuples in insertion order.

```ts
const scores = v.map({ key: v.string(), value: v.number() })

scores.toKeys() // string[]
scores.toValues() // number[]
scores.toEntries() // Array<[string, number]>
```

These representation transforms are synchronous, emit no new issue, and do not mutate the source collection. `toObject()` is intentionally not implied because object conversion requires a separate key/prototype/collision policy.

## JSON transforms

### `toJSONValue<T = unknown>(options?)`

Parses a JSON string with `JSON.parse`.

**Issue code:** `toJSONValue:invalid_json`

The generic type parameter is an output assertion. Use `use()` after parsing when the parsed structure must also be validated.

### `toJSONString(options?)`

Serializes a supported value with JSON semantics after a single-read preflight. Inherited and symbol-keyed properties are ignored, sparse array holes become `null`, boxed string/number/boolean values are unboxed, and `NaN` or infinity serialize as `null`.

Issue codes:

- `toJSONString:unserializable` (`validation`) — payload `{ reason, value, at, valueType? }`
- `toJSONString:serialization_failed` (`operation`) — payload `{ value, at, error }`

## Primitive conversions

Native conversions are available after outputs that are not already entirely the target primitive type. Identity conversions are hidden by the state-aware API.

### `toNumber(options?)`

Delegates to `Number(value)`. It does not add parsing, finite-number, or precision-safety policy. Native exceptions become `toNumber:conversion_failed`.

### `toBoolean()`

Delegates to `Boolean(value)` truthiness coercion. It does not parse semantic boolean strings.

### `toBigint(options?)`

Delegates to `BigInt(value)`. Native conversion exceptions become `toBigint:conversion_failed`.

### `bigint().toSafeNumber(options?)`

Converts only values within JavaScript's safe integer range.

**Issue code:** `toSafeNumber:out_of_safe_integer_range`

### `toMappedBoolean(options)`

Maps configured string, number, or bigint values to booleans without coercion, trimming, or case normalization.

```ts
v.string()
	.toMappedBoolean({
		trueValues: ['Y', 'yes'],
		falseValues: ['N', 'no'],
		message: 'Expected a configured boolean value.',
	})
```

Mappings use SameValueZero equality. Configuration arrays are immutable schema-time snapshots. Both mappings may not be empty, and their values may not overlap.

**Issue code:** `toMappedBoolean:unmapped_value`

## General conversion

### `toString(...nativeArguments)`

Calls the current value's `toString` method and preserves its native parameters and return type.

**Issue code:** `toString:conversion_failed` (`operation`)

Because arguments belong to the native method, this step does not accept a trailing per-step message object. Global and code-map handlers still receive the typed issue.

## Generic transform

### `transform(fn, options?)`

Remains the high-level escape hatch for arbitrary output changes. The callback may return a direct or supported asynchronous value. Throwing or rejecting emits `transform:callback_failed` with `{ phase, value, error }`.

Type-changing transforms flow into subsequent state-aware methods:

```ts
const tags = v.string()
	.toSplit(',')
	.toMapped(value => value.trim())
	.toFiltered(value => value.length > 0)
```

## Forcing native promise output

### `toAsync()`

Forces every invocation of the complete schema to return a native `Promise`, including otherwise synchronous successes and early failures.
