<!-- step-doc
category: primitives
section: length-and-inclusion
summary: inclusive lower bound on the observed `length`
-->

### `isLengthAtLeast(minimum, options?)`

Checks that the value's own `length` is greater than or equal to the minimum; the bound is
inclusive. The runtime reads `length` once and snapshots it in the failure payload, so the length
that was compared is the length that is reported. It is available after any output that exposes a
numeric `length`, which includes strings and arrays.

```ts
v.string()
	.isLengthAtLeast(3)
	.execute('hello')
// { value: 'hello' }

v.string()
	.isLengthAtLeast(3)
	.execute('hi')
// failure, payload { value: 'hi', minimumLength: 3, length: 2 }
```

**Issue code:** `isLengthAtLeast:expected_length_at_least` — the observed length is below the
minimum. Payload `{ value, minimumLength, length }`.
