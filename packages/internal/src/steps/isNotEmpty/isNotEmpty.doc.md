<!-- step-doc
category: primitives
section: length-and-inclusion
summary: an observed `length` or `size` greater than zero
-->

### `isNotEmpty(options?)`

Checks that the observed `length` or `size` is greater than zero, so it is available after a string
or an array through `length`, and after a Map or a Set through `size`. As in `isEmpty()`, the
runtime probes `length` first and falls back to `size` only when `length` is not a number, and it
reads whichever property it uses exactly once — the number that is compared is the number the
failure payload reports.

```ts
v.string()
	.isNotEmpty()
	.execute('value')
// { value: 'value' }

v.map({ key: v.string(), value: v.number() })
	.isNotEmpty()
	.execute(new Map())
// failure, payload { value: Map {}, size: 0 }
```

**Issue code:** `isNotEmpty:expected_not_empty` — the observed `length` or `size` is zero. The
payload is `{ value, length }` for a length-bearing value and `{ value, size }` for a size-bearing
one.
