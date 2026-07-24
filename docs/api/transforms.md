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

### Collection callback transforms

Collection callbacks receive the current transformed pipeline collection, not the caller's original Map or Set. Map entries and Set items are snapshotted when the callback step begins, so callback mutations do not extend the current traversal. The callback receives a stable collection reference for every reached item.

Callback return values are consumed synchronously. Returned promises remain Set items, Map keys, or Map values and do not make these steps asynchronous.

#### Set `toMapped(mapper, options?)`

Maps Set items through `(item, index, value)` and returns `Set<Mapped>`. Callback exceptions emit `toMapped:callback_failed`. Mapped items must remain unique under SameValueZero; collisions emit `toMapped:duplicate_mapped_item` with both source items and indices.

#### Set `toFiltered(predicate, options?)`

Filters Set items through `(item, index, value)` and returns a new Set. Type-guard predicates narrow the output item type. Callback exceptions emit `toFiltered:callback_failed`. A returned promise is an ordinary truthy predicate result.

#### Map `toMappedValues(mapper, options?)`

Maps values through `(entryValue, key, index, value)` while preserving keys and insertion order. Callback exceptions emit `toMappedValues:callback_failed`.

#### Map `toMappedKeys(mapper, options?)`

Maps keys through `(key, entryValue, index, value)` while preserving values and insertion order. Callback exceptions emit `toMappedKeys:callback_failed`. Mapped keys must remain unique under SameValueZero; collisions emit `toMappedKeys:duplicate_mapped_key` with both source keys and indices.

```ts
const tags = v.set(v.string())
	.toMapped((item, index) => `${index}:${item}`)
	.toFiltered(item => item.length > 2)

const scores = v.map({ key: v.string(), value: v.number() })
	.toMappedKeys(key => key.toLowerCase())
	.toMappedValues(value => value * 2)
```

Map filtering and Map-to-object conversion remain outside this contract.

## JSON transforms

### `toJSONValue<T = unknown>(options?)`

Parses a JSON string with `JSON.parse`.

**Issue code:** `toJSONValue:invalid_json`

The generic type parameter is an output assertion. Use `use()` after parsing when the parsed structure must also be validated.

### `toJSONString(options?)`

Serializes a supported value with JSON semantics after a single-read preflight. Inherited and symbol-keyed properties are ignored, boxed string/number/boolean values are unboxed, and `NaN` or infinity serialize as `null`.

Lossy slots are treated uniformly and strictly: an explicit `undefined`, a `function` or `symbol` value, and a sparse array hole all fail rather than being silently coerced. A hole fails with `toJSONString:unserializable` carrying `{ reason: 'undefined_result' }` at the hole's path, the same as an explicit `undefined` element. (Native `JSON.stringify` would instead write `null` for a hole.)

Issue codes:

- `toJSONString:unserializable` (`validation`) — payload `{ reason, value, at, valueType? }`, where `reason` is `'undefined_result'`, `'unsupported_type'`, or `'circular_reference'`
- `toJSONString:serialization_failed` (`operation`) — payload `{ value, at, error }`

## Primitive conversions

Native conversions are available after outputs that are not already entirely the target primitive type. Identity conversions are hidden by the state-aware API.

### `toNumber(options?)`

Delegates to `Number(value)`. It does not add parsing, finite-number, or precision-safety policy. Native exceptions become `toNumber:conversion_failed` (`operation`).

### `toBoolean()`

Delegates to `Boolean(value)` truthiness coercion. It does not parse semantic boolean strings.

### `toBigint(options?)`

Delegates to `BigInt(value)`. Native conversion exceptions become `toBigint:conversion_failed` (`operation`).

### `bigint().toSafeNumber(options?)`

Converts only values within JavaScript's safe integer range.

**Issue code:** `toSafeNumber:out_of_safe_integer_range`

### `toDate(options?)`

Converts a `number` (epoch milliseconds) or ISO `string` to a `Date` with `new Date(value)`. Available after a `string | number` output. A native exception, or a result that is an Invalid Date (for example from an unparseable string), becomes `toDate:conversion_failed` (`operation`). The payload `error` holds the thrown exception when the native conversion threw, and is `undefined` for an Invalid Date result.

**Issue code:** `toDate:conversion_failed`

```ts
v.string()
	.toDate()
	.execute('2020-01-01') // { value: Date }
```

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

### `toString(options?)`

Converts the current value to a string by delegating to the value's own `toString` instance method (for example `(255).toString(16)`). It deliberately does not use `String(value)` and never consults `Symbol.toPrimitive`.

Supply an optional `radix` (forwarded to the instance method; meaningful for `number` and `bigint`, ignored by other built-in `toString` implementations) and an optional `message` in the trailing options object:

```ts
v.number()
	.toString({ radix: 16 })
	.execute(255)
// { value: 'ff' }
```

**Issue code:** `toString:conversion_failed` (`operation`)

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
