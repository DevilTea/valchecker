<!-- step-doc
category: transforms
section: array
summary: filtered array or Set output
-->

### `toFiltered(predicate, options?)`

Keeps the items accepted by the predicate, without mutating the input. Type-guard predicates narrow
the output item type. Optional `thisArg` and `message` belong to the options object.

#### After an array output

The predicate receives `(item, index, value)` and a new array of the accepted elements is produced.

```ts
v.array(v.number())
	.toFiltered(item => item > 2)
	.execute([1, 2, 3])
// { value: [3] }
```

#### After a Set output

The predicate receives `(item, index, value)` and a new Set of the accepted items is produced. Here
`value` is the current pipeline Set rather than the caller's original, and its items are snapshotted
when the step begins, so a callback that mutates it does not extend the traversal. A returned
promise is an ordinary truthy predicate result, not awaited work.

```ts
v.set(v.any())
	.toFiltered((item): item is string => typeof item === 'string')
	.execute(new Set(['a', 1, 'b']))
// { value: Set { 'a', 'b' } }
```

**Issue code:** `toFiltered:callback_failed` (`operation`) — the predicate threw. Payload
`{ value, item, index, error }`.

An exception thrown by the underlying array `filter` operation outside the predicate remains a core
internal failure rather than becoming this issue.
