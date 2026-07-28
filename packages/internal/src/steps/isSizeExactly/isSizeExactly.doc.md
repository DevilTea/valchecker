<!-- step-doc
category: structures
section: size-and-membership
summary: an exact numeric `size`
-->

### `isSizeExactly(expectedSize, options?)`

Checks that the observed `size` equals the expected size. It is available after any output that
exposes a numeric `size`, and preserves the successful value.

```ts
const exactlyTwo = v.set(v.number())
	.isSizeExactly(2)

exactlyTwo.execute(new Set([1, 2])) // success
exactlyTwo.execute(new Set([1])) // failure
```

**Issue code:** `isSizeExactly:expected_size_exactly` — the observed size is not exactly the
expected size. Payload `{ value, expectedSize, size }`.
