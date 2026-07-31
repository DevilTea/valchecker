<!-- step-doc
category: primitives
section: length-and-inclusion
summary: inclusive upper bound on the observed `length`
-->

### `isLengthAtMost(maximum, options?)`

Checks that the value's own `length` is less than or equal to the maximum; the bound is inclusive.
The runtime reads `length` once and snapshots it in the failure payload, so the length that was
compared is the length that is reported. It is available after any output that exposes a numeric
`length`, which includes strings and arrays.

```ts
v.string()
	.isLengthAtLeast(3)
	.isLengthAtMost(20)
	.execute('hello')
// { value: 'hello' }

v.string()
	.isLengthAtMost(3)
	.execute('hello')
// failure, payload { value: 'hello', maximumLength: 3, length: 5 }
```

**Issue code:** `isLengthAtMost:expected_length_at_most` — the observed length exceeds the
maximum. Payload `{ value, maximumLength, length }`.
