<!-- step-doc
category: structures
section: collections
summary: Set items validated and transformed in insertion order, with transformed items kept unique
-->

### `set(itemSchema, options?)`

Validates Set items in insertion order and returns their transformed outputs in a new Set. The input
Set is not mutated, and the output is a new Set even when every item maps to itself.

```ts
const tags = v.set(
	v.string()
		.toTrimmed()
		.toLowercase(),
)

tags.execute(new Set([' TS ', 'Vue']))
// { value: new Set(['ts', 'vue']) }
```

Items are consumed lazily from the native Set iterator, so a first-issue short-circuit never scans
the remaining items and a child step that mutates the input Set during validation observes the same
live iteration as the underlying Set iterator. Iteration goes through `Set.prototype.values` rather
than through the instance, so an overridden `values` cannot redirect validation away from the Set's
actual items. Fully synchronous child schemas keep the Set schema synchronous; after a reached
thenable, remaining items continue sequentially in insertion order.

By default, the first recoverable item or transformed-item collision stops traversal.
`collectAllIssues: true` preserves complete recoverable issue collection, while an internal child
issue always stops later items.

If two source items transform to the same value under the native Set SameValueZero comparison,
`set:duplicate_transformed_item` is returned instead of silently reducing Set cardinality.

The options `message` participates in normal structure message resolution for both owned and nested
child issues, after their `[index]` paths are prepended.

**Issues:**

- `set:expected_set` — the value is not a `Set`. Payload `{ value }`.
- `set:duplicate_transformed_item` — two items produced the same transformed value. Payload
  `{ value, firstItem, item, transformedItem, firstIndex, index }`, at path `[index]`.
- item-schema issues, with `[index]` prepended to their paths.
