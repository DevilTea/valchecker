<!-- step-doc
category: transforms
section: collection
summary: Map key callback transform whose mapped keys stay unique
-->

### `toMappedKeys(mapper, options?)`

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
