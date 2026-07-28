<!-- step-doc
category: structures
section: size-and-membership
summary: Map value membership
-->

### `isIncludingValue(value, options?)`

Checks that a Map includes the configured value, searching the Map's entry values with SameValueZero
equality. The successful value is preserved.

```ts
const withScoreOne = v.map({ key: v.string(), value: v.number() })
	.isIncludingValue(1)

withScoreOne.execute(new Map([['primary', 1]])) // success
withScoreOne.execute(new Map([['primary', 2]])) // failure
```

**Issue code:** `isIncludingValue:expected_including_value` — no entry value equals the configured
value. Payload `{ value, expectedValue }`.
