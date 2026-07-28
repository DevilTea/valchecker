<!-- step-doc
category: transforms
section: array
summary: mapped array or Set output with structured callback failures; Set outputs remain unique
-->

### `toMapped(mapper, options?)`

Maps each item without mutating the input. Optional `thisArg` and `message` belong to the options
object.

#### After an array output

Follows synchronous `Array.prototype.map` semantics. The mapper receives `(item, index, value)`, and
its return values are preserved exactly: a returned promise remains an array item and does not make
the step asynchronous.

```ts
v.array(v.number())
	.toMapped((value, index) => value + index)
	.execute([1, 2])
// { value: [1, 3] }
```

#### After a Set output

Maps items through `(item, index, value)` and returns `Set<Mapped>`. Here `value` is the current
pipeline Set rather than the caller's original, and its items are snapshotted when the step begins,
so a callback that mutates it does not extend the traversal. Mapped items must remain unique under
SameValueZero.

```ts
v.set(v.number())
	.toMapped(item => item * 2)
	.execute(new Set([1, 2]))
// { value: Set { 2, 4 } }
```

Issue codes:

- `toMapped:callback_failed` (`operation`) — the mapper threw. Payload
  `{ value, item, index, error }`. Errors thrown by the underlying array `map` operation outside the
  mapper remain core internal failures instead
- `toMapped:duplicate_mapped_item` — two Set items produced the same mapped item. Payload
  `{ value, firstItem, item, mappedItem, firstIndex, index }`, carrying both source items and their
  indices
