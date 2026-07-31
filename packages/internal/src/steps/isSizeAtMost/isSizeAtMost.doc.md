<!-- step-doc
category: structures
section: size-and-membership
summary: inclusive upper bound on a numeric `size`
-->

### `isSizeAtMost(maximumSize, options?)`

Checks that the observed `size` is less than or equal to the maximum. It is available after any
output that exposes a numeric `size`, and preserves the successful value — an upload size limit is
`v.file().isSizeAtMost(bytes)`.

```ts
const atMostTwo = v.map({ key: v.string(), value: v.number() })
	.isSizeAtMost(2)

atMostTwo.execute(new Map([['a', 1]])) // success
atMostTwo.execute(new Map([['a', 1], ['b', 2], ['c', 3]])) // failure
```

**Issue code:** `isSizeAtMost:expected_size_at_most` — the observed size exceeds the maximum.
Payload `{ value, maximumSize, size }`.
