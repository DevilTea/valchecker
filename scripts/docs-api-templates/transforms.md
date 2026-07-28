# Transforms

Concrete transformation steps use the `toXxx` prefix and replace the successful pipeline value. Message-bearing transformations use a trailing options object, and a transformation that cannot fail owns no issue.

## String transforms

<!-- steps: string -->

## Array transforms

`toFiltered()` and `toMapped()` are also available after a Set output; both variants are documented in one entry.

<!-- steps: array -->

## Collection transforms

Collection callbacks receive the current transformed pipeline collection, not the caller's original Map or Set. Map entries and Set items are snapshotted when the callback step begins, so callback mutations do not extend the current traversal. The callback receives a stable collection reference for every reached item.

Callback return values are consumed synchronously. Returned promises remain Set items, Map keys, or Map values and do not make these steps asynchronous. The same holds for the Set variants of `toMapped()` and `toFiltered()` above.

Map filtering and Map-to-object conversion remain outside this contract: `toObject()` is intentionally not implied, because object conversion requires a separate key, prototype, and collision policy.

<!-- steps: collection -->

```ts
const tags = v.set(v.string())
	.toMapped((item, index) => `${index}:${item}`)
	.toFiltered(item => item.length > 2)

const scores = v.map({ key: v.string(), value: v.number() })
	.toMappedKeys(key => key.toLowerCase())
	.toMappedValues(value => value * 2)
```

## JSON transforms

<!-- steps: json -->

## Primitive conversions

Native conversions are available after outputs that are not already entirely the target primitive type, so identity conversions such as `number().toNumber()` are hidden by the state-aware API. They deliberately follow JavaScript semantics and add no hidden parsing, finite-number, or precision policy; a native exception becomes a structured `operation` issue rather than propagating. Reach for the explicitly named policy conversions — `toSafeNumber()`, `toMappedBoolean()` — when a narrower contract is required.

<!-- steps: primitive-conversion -->

## General conversion

<!-- steps: general-conversion -->

## Related pages

- `transform()`, the escape hatch for an arbitrary output change, is on [Helpers & Utilities](/api/helpers#transform).
- `toAsync()`, which forces every invocation of the complete schema to return a native promise, is on [Helpers & Utilities](/api/helpers#toAsync).
