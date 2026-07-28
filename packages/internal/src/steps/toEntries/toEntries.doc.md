<!-- step-doc
category: transforms
section: collection
summary: Map entries as mutable `[key, value]` tuples
-->

### `toEntries()`

Replaces a Map with a new array of mutable `[key, value]` tuples in insertion order. This
representation transform is synchronous, emits no new issue, and does not mutate the source
collection.

```ts
v.map({ key: v.string(), value: v.number() })
	.toEntries()
	.execute(new Map([['b', 2], ['a', 1]]))
// { value: [['b', 2], ['a', 1]] }
```
