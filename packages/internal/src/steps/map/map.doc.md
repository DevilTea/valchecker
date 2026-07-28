<!-- step-doc
category: structures
section: collections
summary: Map keys and values validated and transformed, with transformed keys kept unique
-->

### `map({ key, value, message?, collectAllIssues? })`

Validates Map keys and values in insertion order and returns a new Map containing their transformed
outputs. The key schema, value schema, enclosing message, and issue-collection policy are supplied
through one configuration object.

```ts
const scores = v.map({
	key: v.string()
		.toTrimmed(),
	value: v.number()
		.isFinite(),
})

scores.execute(new Map([
	[' Alice ', 100],
	[' Bob ', 90],
]))
// { value: new Map([['Alice', 100], ['Bob', 90]]) }
```

For each entry, the key schema executes before the value schema. In the default mode, a key failure
skips that entry's value and stops later entries; a value failure also stops later entries. With
`collectAllIssues: true`, a recoverable key failure does not hide a value failure from the same
entry, and later entries are still checked. An internal key issue stops before the current value
schema, and any internal child issue stops later entries.

Entries are consumed lazily from the native Map iterator, so a first-issue short-circuit never scans
the remaining entries and a child step that mutates the input Map during validation observes the same
live iteration as the underlying Map iterator. Iteration goes through `Map.prototype.entries` rather
than through the instance, so an overridden `entries`, `forEach`, or `size` cannot redirect
validation away from the Map's actual entries. Fully synchronous key and value schemas keep the Map
schema synchronous; reached thenables continue sequentially.

The output is always a new Map, so the input is never mutated — not even when every key and value
maps to itself.

If two successful source keys transform to the same value under the native Map SameValueZero
comparison, `map:duplicate_transformed_key` is returned instead of applying last-write-wins data
loss.

The configuration's `message` participates in normal structure message resolution for both owned and
nested child issues, after their collection paths are prepended.

**Issues:**

- `map:expected_map` — the value is not a `Map`. Payload `{ value }`.
- `map:duplicate_transformed_key` — two entries produced the same transformed key. Payload
  `{ value, firstSourceKey, sourceKey, transformedKey, firstIndex, index }`, at path
  `[index, 'key']`.
- key-schema issues, with `[index, 'key']` prepended to their paths.
- value-schema issues, with `[index, 'value']` prepended to their paths.
