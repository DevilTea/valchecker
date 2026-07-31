<!-- step-doc
category: structures
section: size-and-membership
summary: Map key membership
-->

### `isIncludingKey(key, options?)`

Checks that a Map includes the configured key, searching the Map's keys through
`Map.prototype.has()`. The successful value is preserved.

```ts
const withPrimary = v.map({ key: v.string(), value: v.number() })
	.isIncludingKey('primary')

withPrimary.execute(new Map([['primary', 1]])) // success
withPrimary.execute(new Map([['secondary', 1]])) // failure
```

**Issue code:** `isIncludingKey:expected_including_key` — the Map has no such key. Payload
`{ value, expectedKey }`.
