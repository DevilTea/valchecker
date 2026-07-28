<!-- step-doc
category: structures
section: size-and-membership
summary: inclusive lower bound on a numeric `size`
-->

### `isSizeAtLeast(minimumSize, options?)`

Checks that the observed `size` is greater than or equal to the minimum. It is available after any
output that exposes a numeric `size`, and preserves the successful value.

```ts
const atLeastOne = v.set(v.string())
	.isSizeAtLeast(1)

atLeastOne.execute(new Set(['a'])) // success
atLeastOne.execute(new Set()) // failure
```

**Issue code:** `isSizeAtLeast:expected_size_at_least` — the observed size is below the minimum.
Payload `{ value, minimumSize, size }`.
