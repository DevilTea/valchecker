<!-- step-doc
category: primitives
section: length-and-inclusion
summary: an observed `length` or `size` of zero
-->

### `isEmpty(options?)`

Checks that the observed `length` or `size` equals zero, so it is available after a string or an
array through `length`, and after a Map or a Set through `size`. The runtime probes `length` first
and falls back to `size` only when `length` is not a number, and it reads whichever property it uses
exactly once — the number that is compared is the number the failure payload reports, even for a
getter that would answer differently on a second read.

```ts
v.string()
	.isEmpty()
	.execute('')
// { value: '' }

v.set(v.string())
	.isEmpty()
	.execute(new Set(['x']))
// failure, payload { value: Set { 'x' }, size: 1 }
```

**Issue code:** `isEmpty:expected_empty` — the observed `length` or `size` is not zero. The
payload is `{ value, length }` for a length-bearing value and `{ value, size }` for a size-bearing
one.
