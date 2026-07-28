<!-- Generated file. Do not edit it: `pnpm docs:api` fails when it stops matching its sources,
and `pnpm docs:api:update` rewrites it.

Each step's entry comes from `packages/internal/src/steps/<name>/<name>.doc.md`. The prose
around them, and the order the sections appear in, come from `scripts/docs-api-templates/<page>.md`. -->

# Transforms

Concrete transformation steps use the `toXxx` prefix and replace the successful pipeline value. Message-bearing transformations use a trailing options object, and a transformation that cannot fail owns no issue.

## String transforms

### `toLowercase()` {#toLowercase}

Converts a string to lowercase by delegating to `String.prototype.toLowerCase`. It does not use the
locale-sensitive `toLocaleLowerCase`.

```ts
v.string()
	.toLowercase()
	.execute('HELLO')
// { value: 'hello' }
```

This pure transformation emits no issue.

### `toNormalized(options?)` {#toNormalized}

Normalizes a string with `String.prototype.normalize`. `form` may be `NFC`, `NFD`, `NFKC`, or
`NFKD`; the default is `NFC`.

This pure transformation does not emit an issue. An unsupported form supplied by a JavaScript caller
is rejected while constructing the schema, with a `TypeError` rather than an execution failure.

```ts
v.string()
	.toNormalized({ form: 'NFC' })
	.execute('e\u0301')
// { value: 'é' }
```

### `toSplit(separator, limit?)` {#toSplit}

Delegates to `String.prototype.split` and outputs a string array. The parameters are that method's
own, so `separator` may be a string or a regular expression and `limit` is forwarded unchanged.

```ts
v.string()
	.toSplit(',', 2)
	.execute('a,b,c')
// { value: ['a', 'b'] }
```

This pure transformation emits no issue.

### `toTrimmed()` {#toTrimmed}

Trims whitespace from both ends of the string by delegating to `String.prototype.trim`.

```ts
v.string()
	.toTrimmed()
	.execute('  hello  ')
// { value: 'hello' }
```

This pure transformation emits no issue.

### `toTrimmedEnd()` {#toTrimmedEnd}

Trims whitespace from the end of the string by delegating to `String.prototype.trimEnd`.

```ts
v.string()
	.toTrimmedEnd()
	.execute('  hello  ')
// { value: '  hello' }
```

This pure transformation emits no issue.

### `toTrimmedStart()` {#toTrimmedStart}

Trims whitespace from the beginning of the string by delegating to `String.prototype.trimStart`.

```ts
v.string()
	.toTrimmedStart()
	.execute('  hello  ')
// { value: 'hello  ' }
```

This pure transformation emits no issue.

### `toUppercase()` {#toUppercase}

Converts a string to uppercase by delegating to `String.prototype.toUpperCase`. It does not use the
locale-sensitive `toLocaleUpperCase`.

```ts
v.string()
	.toUppercase()
	.execute('hello')
// { value: 'HELLO' }
```

This pure transformation emits no issue.

## Array transforms

`toFiltered()` and `toMapped()` are also available after a Set output; both variants are documented in one entry.

### `toFiltered(predicate, options?)` {#toFiltered}

Keeps the items accepted by the predicate, without mutating the input. Type-guard predicates narrow
the output item type. Optional `thisArg` and `message` belong to the options object.

#### After an array output

The predicate receives `(item, index, value)` and a new array of the accepted elements is produced.

```ts
v.array(v.number())
	.toFiltered(item => item > 2)
	.execute([1, 2, 3])
// { value: [3] }
```

#### After a Set output

The predicate receives `(item, index, value)` and a new Set of the accepted items is produced. Here
`value` is the current pipeline Set rather than the caller's original, and its items are snapshotted
when the step begins, so a callback that mutates it does not extend the traversal. A returned
promise is an ordinary truthy predicate result, not awaited work.

```ts
v.set(v.any())
	.toFiltered((item): item is string => typeof item === 'string')
	.execute(new Set(['a', 1, 'b']))
// { value: Set { 'a', 'b' } }
```

**Issue code:** `toFiltered:callback_failed` (`operation`) — the predicate threw. Payload
`{ value, item, index, error }`.

An exception thrown by the underlying array `filter` operation outside the predicate remains a core
internal failure rather than becoming this issue.

### `toLength()` {#toLength}

Replaces a length-bearing value with its numeric `length`. It is available after any output carrying
a numeric `length`, so both a string and an array qualify.

```ts
v.array(v.number())
	.toLength()
	.execute([1, 2, 3])
// { value: 3 }
```

This pure transformation emits no issue.

### `toMapped(mapper, options?)` {#toMapped}

Maps each item without mutating the input. Optional `thisArg` and `message` belong to the options
object.

#### After an array output

Follows synchronous `Array.prototype.map` semantics. The mapper receives `(item, index, value)`, and
its return values are preserved exactly: a returned promise remains an array item and does not make
the step asynchronous.

```ts
v.array(v.number())
	.toMapped((value, index) => value + index)
	.execute([1, 2])
// { value: [1, 3] }
```

#### After a Set output

Maps items through `(item, index, value)` and returns `Set<Mapped>`. Here `value` is the current
pipeline Set rather than the caller's original, and its items are snapshotted when the step begins,
so a callback that mutates it does not extend the traversal. Mapped items must remain unique under
SameValueZero.

```ts
v.set(v.number())
	.toMapped(item => item * 2)
	.execute(new Set([1, 2]))
// { value: Set { 2, 4 } }
```

Issue codes:

- `toMapped:callback_failed` (`operation`) — the mapper threw. Payload
  `{ value, item, index, error }`. Errors thrown by the underlying array `map` operation outside the
  mapper remain core internal failures instead
- `toMapped:duplicate_mapped_item` — two Set items produced the same mapped item. Payload
  `{ value, firstItem, item, mappedItem, firstIndex, index }`, carrying both source items and their
  indices

### `toSliced(start, end?)` {#toSliced}

Forwards its arguments to the current value's `slice` method, so it is available after any output
that has one — a string or an array in practice — and its parameters and output type are that
method's own. Out-of-range and negative indices therefore behave exactly as the native method does.

```ts
v.array(v.number())
	.toSliced(1, 4)
	.execute([1, 2, 3, 4, 5])
// { value: [2, 3, 4] }

v.string()
	.toSliced(1, 4)
	.execute('hello')
// { value: 'ell' }
```

This pure transformation emits no issue.

### `toSorted(options?)` {#toSorted}

Returns a sorted array without mutating the input. Supply `compareFn` and `message` in the options
object; without a comparator the native `Array.prototype.toSorted()` default ordering applies.

```ts
v.array(v.number())
	.toSorted({ compareFn: (left, right) => left - right })
	.execute([3, 1, 2])
// { value: [1, 2, 3] }
```

**Issue code:** `toSorted:callback_failed` (`operation`) — the comparator threw. Payload
`{ value, left, right, error }`, carrying both compared operands.

An exception thrown by the underlying `toSorted` operation outside the comparator remains a core
internal failure rather than becoming this issue.

## Collection transforms

Collection callbacks receive the current transformed pipeline collection, not the caller's original Map or Set. Map entries and Set items are snapshotted when the callback step begins, so callback mutations do not extend the current traversal. The callback receives a stable collection reference for every reached item.

Callback return values are consumed synchronously. Returned promises remain Set items, Map keys, or Map values and do not make these steps asynchronous. The same holds for the Set variants of `toMapped()` and `toFiltered()` above.

Map filtering and Map-to-object conversion remain outside this contract: `toObject()` is intentionally not implied, because object conversion requires a separate key, prototype, and collision policy.

### `toArray()` {#toArray}

Replaces a Set with a new array of its items in insertion order. This synchronous transformation
does not mutate the source Set and emits no issue.

```ts
v.set(v.string())
	.toArray()
	.execute(new Set(['b', 'a']))
// { value: ['b', 'a'] }
```

### `toEntries()` {#toEntries}

Replaces a Map with a new array of mutable `[key, value]` tuples in insertion order. This
representation transform is synchronous, emits no new issue, and does not mutate the source
collection.

```ts
v.map({ key: v.string(), value: v.number() })
	.toEntries()
	.execute(new Map([['b', 2], ['a', 1]]))
// { value: [['b', 2], ['a', 1]] }
```

### `toKeys()` {#toKeys}

Replaces a Map with a new array of its keys in insertion order. This representation transform is
synchronous, emits no new issue, and does not mutate the source collection.

```ts
v.map({ key: v.string(), value: v.number() })
	.toKeys()
	.execute(new Map([['b', 2], ['a', 1]]))
// { value: ['b', 'a'] }
```

### `toMappedKeys(mapper, options?)` {#toMappedKeys}

Maps Map keys through `(key, entryValue, index, value)` while preserving values and insertion order.
Mapped keys must remain unique under the SameValueZero semantics a native Map uses. Optional
`thisArg` and `message` belong to the options object.

```ts
v.map({ key: v.string(), value: v.number() })
	.toMappedKeys(key => key.toUpperCase())
	.execute(new Map([['a', 1]]))
// { value: Map { 'A' => 1 } }
```

Issue codes:

- `toMappedKeys:callback_failed` (`operation`) — the mapper threw. Payload
  `{ value, key, entryValue, index, error }`
- `toMappedKeys:duplicate_mapped_key` — two entries produced the same mapped key. Payload
  `{ value, firstSourceKey, sourceKey, mappedKey, firstIndex, index }`, carrying both source keys
  and their indices

### `toMappedValues(mapper, options?)` {#toMappedValues}

Maps Map values through `(entryValue, key, index, value)` while preserving keys and insertion order.
Optional `thisArg` and `message` belong to the options object.

```ts
v.map({ key: v.string(), value: v.number() })
	.toMappedValues(entryValue => entryValue * 2)
	.execute(new Map([['a', 1]]))
// { value: Map { 'a' => 2 } }
```

**Issue code:** `toMappedValues:callback_failed` (`operation`) — the mapper threw. Payload
`{ value, key, entryValue, index, error }`.

### `toSize()` {#toSize}

Replaces a size-bearing value such as a Map or Set with its numeric `size`, leaving the source
collection untouched. This pure transformation emits no issue.

```ts
v.set(v.string())
	.toSize()
	.execute(new Set(['a', 'b']))
// { value: 2 }
```

### `toValues()` {#toValues}

Replaces a Map with a new array of its values in insertion order. This representation transform is
synchronous, emits no new issue, and does not mutate the source collection.

```ts
v.map({ key: v.string(), value: v.number() })
	.toValues()
	.execute(new Map([['b', 2], ['a', 1]]))
// { value: [2, 1] }
```

```ts
const tags = v.set(v.string())
	.toMapped((item, index) => `${index}:${item}`)
	.toFiltered(item => item.length > 2)

const scores = v.map({ key: v.string(), value: v.number() })
	.toMappedKeys(key => key.toLowerCase())
	.toMappedValues(value => value * 2)
```

## JSON transforms

### `toJSONString(options?)` {#toJSONString}

Serializes a supported value with JSON semantics after a single-read preflight: the value is walked
once, and the plain copy that walk produces is what `JSON.stringify` receives, so a getter, a
`toJSON` method, or a Proxy trap runs exactly once. Inherited and symbol-keyed properties are
ignored, boxed string/number/boolean values are unboxed, and `NaN` or infinity serialize as `null`.

Lossy slots are treated uniformly and strictly: an explicit `undefined`, a `function` or `symbol`
value, and a sparse array hole all fail rather than being silently coerced. A hole fails with
`toJSONString:unserializable` carrying `{ reason: 'undefined_result' }` at the hole's path, the same
as an explicit `undefined` element. (Native `JSON.stringify` would instead write `null` for a hole.)

```ts
v.unknown()
	.toJSONString()
	.execute({ value: 42 })
// { value: '{"value":42}' }

v.unknown()
	.toJSONString()
	.execute([1, undefined, 3])
// failure, at [1]
```

**Issues:**

- `toJSONString:unserializable` (`validation`) — the value, or a nested slot, has no JSON
  representation. Payload `{ reason, value, at, valueType? }`, where `reason` is
  `'undefined_result'`, `'unsupported_type'`, or `'circular_reference'`, `at` is the path of the
  offending slot, and `valueType` is present only for `'unsupported_type'`, where it is `'bigint'`,
  `'function'`, or `'symbol'`
- `toJSONString:serialization_failed` (`operation`) — a getter, a Proxy trap, or a `toJSON` method
  threw while the value was being read. Payload `{ value, at, error }`

### `toJSONValue<T = unknown>(options?)` {#toJSONValue}

Parses a JSON string with `JSON.parse`. The method is available after a `string` output.

The generic type parameter is an output assertion, not a check: it changes the inferred output type
and nothing about what runs. Use `use()` after parsing when the parsed structure must also be
validated.

```ts
v.string()
	.toJSONValue<{ value: number }>()
	.execute('{"value":42}')
// { value: { value: 42 } }

v.string()
	.toJSONValue()
	.execute('{')
// failure
```

**Issue code:** `toJSONValue:invalid_json` — `JSON.parse` threw on the string. Payload
`{ value, error }`, where `error` is the `SyntaxError` it threw.

## Primitive conversions

Native conversions are available after outputs that are not already entirely the target primitive type, so identity conversions such as `number().toNumber()` are hidden by the state-aware API. They deliberately follow JavaScript semantics and add no hidden parsing, finite-number, or precision policy; a native exception becomes a structured `operation` issue rather than propagating. Reach for the explicitly named policy conversions — `toSafeNumber()`, `toMappedBoolean()` — when a narrower contract is required.

### `toBigint(options?)` {#toBigint}

Converts the current value with JavaScript's native `BigInt()` conversion. It adds no parsing
grammar and no safety policy: `'0x10'` becomes `16n` and `'1.5'` throws, exactly as `BigInt(value)`
does.

The method is available after any output that is not already `bigint`, so the identity conversion
`bigint().toBigint()` is not offered.

```ts
v.string()
	.toBigint()
	.execute('0x10')
// { value: 16n }

v.string()
	.toBigint()
	.execute('1.5')
// failure
```

**Issue code:** `toBigint:conversion_failed` (`operation`) — the native `BigInt()` conversion threw,
which is what a non-integer numeric string, a non-integer or non-finite number, `null`, `undefined`,
and a symbol all do. Payload `{ value, error }`.

### `toBoolean()` {#toBoolean}

Converts the current value with JavaScript's native `Boolean()` truthiness coercion. It does not
parse semantic boolean strings: the non-empty strings `'false'`, `'0'`, and `'no'` all convert to
`true`. Reach for `toMappedBoolean()` when the accepted representations must be declared.

The method is available after any output that is not already `boolean`, so the identity conversion
`boolean().toBoolean()` is not offered. It takes no options, because it cannot fail.

```ts
v.string()
	.toBoolean()
	.execute('false')
// { value: true }

v.string()
	.toBoolean()
	.execute('')
// { value: false }
```

This pure conversion emits no issue.

### `toDate(options?)` {#toDate}

Converts a `number` (epoch milliseconds) or any `string` the host `Date` constructor accepts to a
`Date` with `new Date(value)`. The method is available after a `string | number` output.

A native exception, or a result that is an Invalid Date (for example from an unparseable string,
from the empty string, or from `NaN`), becomes `toDate:conversion_failed`.

```ts
v.string()
	.toDate()
	.execute('2020-01-01') // { value: Date }

v.number()
	.toDate()
	.execute(0) // { value: Date }

v.string()
	.toDate()
	.execute('nope') // failure
```

**Issue code:** `toDate:conversion_failed` (`operation`) — `new Date(value)` threw or produced an
Invalid Date. Payload `{ value, error }`, where `error` holds the thrown exception when the native
conversion threw and is `undefined` for an Invalid Date result.

### `toMappedBoolean(options)` {#toMappedBoolean}

Maps configured string, number, or bigint values to booleans without coercion, trimming, or case
normalization. It is the explicit alternative to `toBoolean()` truthiness, is available after a
`string | number | bigint` output, and the configured values must have the current output type.

```ts
v.string()
	.toMappedBoolean({
		trueValues: ['Y', 'yes'],
		falseValues: ['N', 'no'],
		message: 'Expected a configured boolean value.',
	})
```

Mappings use SameValueZero equality, so `NaN` matches `NaN` and `-0` matches `0`. Configuration
arrays are immutable schema-time snapshots: mutating an array afterwards does not change the schema,
and the snapshot is what the failure payload reports. Supplying two empty mappings, or a value that
appears in both, throws a `TypeError` while the schema is constructed; a one-sided mapping is
allowed.

**Issue code:** `toMappedBoolean:unmapped_value` — the value matches no configured mapping. Payload
`{ value, trueValues, falseValues }`.

### `toNumber(options?)` {#toNumber}

Converts the current value with JavaScript's native `Number()` coercion. It adds no parsing,
finite-number, or precision-safety policy: an invalid numeric string produces `NaN` and a large
bigint may lose precision, exactly as `Number(value)` does. Use `isFinite()` or `toSafeNumber()`
when a narrower contract is required.

The method is available after any output that is not already entirely `number`, so the identity
conversion `number().toNumber()` is not offered.

```ts
v.string()
	.toNumber()
	.execute('42')
// { value: 42 }

v.string()
	.toNumber()
	.execute('nope')
// { value: NaN }
```

**Issue code:** `toNumber:conversion_failed` (`operation`) — the native `Number()` conversion threw,
which is what a symbol input does. Payload `{ value, error }`.

### `toSafeNumber(options?)` {#toSafeNumber}

Converts a bigint to a number, but only when the bigint is within JavaScript's safe integer range,
so the result never loses precision. The method is available after a `bigint` output. Use
`toNumber()` when the native `Number(bigint)` precision loss is acceptable.

```ts
v.bigint()
	.toSafeNumber()
	.execute(42n)
// { value: 42 }

v.bigint()
	.toSafeNumber()
	.execute(BigInt(Number.MAX_SAFE_INTEGER) + 1n)
// failure
```

**Issue code:** `toSafeNumber:out_of_safe_integer_range` — the bigint is outside
`Number.MIN_SAFE_INTEGER` through `Number.MAX_SAFE_INTEGER`, both of which are accepted. Payload
`{ value, minimum, maximum }`, with the two bounds as bigints.

## General conversion

### `toString(options?)` {#toString}

Converts the current value to a string by delegating to the value's own `toString` instance method
(for example `(255).toString(16)`). It deliberately does not use `String(value)` and never consults
`Symbol.toPrimitive`, and it is available after any output that has a `toString` method.

Supply an optional `radix` — forwarded to the instance method, meaningful for `number` and `bigint`,
and ignored by the other built-in `toString` implementations — and an optional `message` in the
trailing options object:

```ts
v.number()
	.toString({ radix: 16 })
	.execute(255)
// { value: 'ff' }
```

**Issue code:** `toString:conversion_failed` (`operation`) — the value's own `toString` method threw.
Payload `{ value, error }`.

## Related pages

- `transform()`, the escape hatch for an arbitrary output change, is on [Helpers & Utilities](/api/helpers#transform).
- `toAsync()`, which forces every invocation of the complete schema to return a native promise, is on [Helpers & Utilities](/api/helpers#toAsync).
