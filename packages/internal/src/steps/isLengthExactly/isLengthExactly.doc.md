<!-- step-doc
category: primitives
section: length-and-inclusion
summary: an exact observed `length`
-->

### `isLengthExactly(expectedLength, options?)`

Checks that the value's own `length` equals the expected length. The runtime reads `length` once and
snapshots it in the failure payload, so the length that was compared is the length that is reported.
It is available after any output that exposes a numeric `length`, which includes strings and arrays.

```ts
v.string()
	.isLengthExactly(8)
	.execute('password')
// { value: 'password' }

v.array(v.number())
	.isLengthExactly(2)
	.execute([1])
// failure, payload { value: [1], expectedLength: 2, length: 1 }
```

**Issue code:** `isLengthExactly:expected_length_exactly` — the observed length is not exactly the
expected length. Payload `{ value, expectedLength, length }`.
