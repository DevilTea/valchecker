<!-- step-doc
category: transforms
section: collection
summary: extract a `size` value
-->

### `toSize()`

Replaces a size-bearing value such as a Map or Set with its numeric `size`, leaving the source
collection untouched. This pure transformation emits no issue.

```ts
v.set(v.string())
	.toSize()
	.execute(new Set(['a', 'b']))
// { value: 2 }
```
