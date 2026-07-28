<!-- step-doc
category: transforms
section: array
summary: sorted array output
-->

### `toSorted(options?)`

Returns a sorted array without mutating the input. Supply `compareFn` and `message` in the options
object; without a comparator the native `Array.prototype.toSorted()` default ordering applies.

```ts
v.array(v.number())
	.toSorted({ compareFn: (left, right) => left - right })
	.execute([3, 1, 2])
// { value: [1, 2, 3] }
```

**Issue code:** `toSorted:callback_failed` (`operation`) — the comparator threw. Payload
`{ value, left, right, error }`, carrying both compared operands.

An exception thrown by the underlying `toSorted` operation outside the comparator remains a core
internal failure rather than becoming this issue.
