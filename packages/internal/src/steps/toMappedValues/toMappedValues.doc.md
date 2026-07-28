<!-- step-doc
category: transforms
section: collection
summary: Map value callback transform
-->

### `toMappedValues(mapper, options?)`

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
